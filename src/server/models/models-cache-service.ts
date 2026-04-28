import type { ProviderFamily } from '@/shared/types';
import { unlink } from 'node:fs/promises';
import { getProviderPools } from '@/server/config/provider-pools-config';
import { getModelMappings } from '@/server/config/model-mappings-config';
import { fetchOpenAIModels } from '@/server/providers/openai-compatible-client';
import { fetchAnthropicModels } from '@/server/providers/anthropic-compatible-client';
import { CONFIG_FILES } from '@/server/config/paths';
import { readJsonFile, writeJsonFile } from '@/server/config/json-store';

export type CachedModel = {
  id: string;
  object: 'model';
  owned_by: string;
  provider: string;
  providerFamily: ProviderFamily;
  providerUuid: string;
  providerCustomName: string;
  source: 'api' | 'manual';
};

export type ModelsCacheFile = {
  refreshedAt: string;
  models: CachedModel[];
};

const LEGACY_MODELS_CACHE_FILE = CONFIG_FILES.modelsCache.replace('models_cache.json', 'models-cache.json');

async function removeLegacyModelsCacheFile() {
  try {
    await unlink(LEGACY_MODELS_CACHE_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function manualModelsForProvider(provider: Awaited<ReturnType<typeof getProviderPools>>[number]['providers'][number]) {
  return provider.manualModels.map((name) => ({
    id: name,
    object: 'model' as const,
    owned_by: provider.providerNumber || provider.customName || 'provider',
    provider: provider.customName,
    providerFamily: provider.family,
    providerUuid: provider.uuid,
    providerCustomName: provider.customName,
    source: 'manual' as const
  }));
}

function cacheModelsFromProviderResponse(
  provider: Awaited<ReturnType<typeof getProviderPools>>[number]['providers'][number],
  data: unknown
): CachedModel[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)
      ? (data as { data: unknown[] }).data
      : data && typeof data === 'object' && Array.isArray((data as { models?: unknown }).models)
        ? (data as { models: unknown[] }).models
        : [];

  return rows
    .map((row) => {
      const entry = typeof row === 'string'
        ? { id: row, owned_by: 'api' }
        : row && typeof row === 'object'
          ? row as { id?: unknown; name?: unknown; model?: unknown; owned_by?: unknown }
          : null;
      if (!entry) return null;
      const idCandidate = typeof entry.id === 'string'
        ? entry.id
        : typeof entry.name === 'string'
          ? entry.name
          : typeof entry.model === 'string'
            ? entry.model
            : '';
      const id = idCandidate.trim();
      if (!id) return null;
      return {
        id,
        object: 'model' as const,
        owned_by: provider.providerNumber || provider.customName || 'provider',
        provider: provider.customName,
        providerFamily: provider.family,
        providerUuid: provider.uuid,
        providerCustomName: provider.customName,
        source: entry.owned_by === 'manual' ? 'manual' as const : 'api' as const
      };
    })
    .filter((model): model is CachedModel => Boolean(model));
}

export async function readModelsCache(): Promise<ModelsCacheFile> {
  const raw = await readJsonFile<ModelsCacheFile>(CONFIG_FILES.modelsCache);
  if (raw && Array.isArray(raw.models)) {
    await removeLegacyModelsCacheFile();
    return raw;
  }
  try {
    const legacy = await readJsonFile<ModelsCacheFile>(LEGACY_MODELS_CACHE_FILE);
    if (legacy && Array.isArray(legacy.models)) {
      await writeJsonFile(CONFIG_FILES.modelsCache, legacy);
      await removeLegacyModelsCacheFile();
      return legacy;
    }
  } catch {
    // Ignore legacy parse/read errors and regenerate from providers.
  }
  await removeLegacyModelsCacheFile();
  return refreshModelsCache();
}

export async function refreshModelsCache(): Promise<ModelsCacheFile> {
  const pools = await getProviderPools();
  const models: CachedModel[] = [];

  for (const pool of pools) {
    for (const provider of pool.providers) {
      if (!provider.enabled) continue;
      const manual = manualModelsForProvider(provider);
      if (pool.family === 'openai-custom' || pool.family === 'anthropic-custom') {
        try {
          const { response, data } = pool.family === 'openai-custom'
            ? await fetchOpenAIModels(provider)
            : await fetchAnthropicModels(provider);
          if (response.ok && Array.isArray(data.data)) {
            models.push(...cacheModelsFromProviderResponse(provider, data));
            continue;
          }
        } catch {
          // Cache refresh should still preserve manually configured models.
        }
      }
      models.push(...manual);
    }
  }

  const deduped = Array.from(new Map(models.map((model) => [`${model.providerUuid}:${model.id}`, model])).values());
  const cache = { refreshedAt: new Date().toISOString(), models: deduped };
  await writeJsonFile(CONFIG_FILES.modelsCache, cache);
  await removeLegacyModelsCacheFile();
  return cache;
}

export async function updateProviderModelsCache(
  provider: Awaited<ReturnType<typeof getProviderPools>>[number]['providers'][number],
  data: unknown
) {
  const current = await readModelsCache();
  const fetched = cacheModelsFromProviderResponse(provider, data);
  const manual = manualModelsForProvider(provider);
  const providerModels = Array.from(
    new Map([...fetched, ...manual].map((model) => [`${model.providerUuid}:${model.id}`, model])).values()
  );
  const retained = current.models.filter((model) => model.providerUuid !== provider.uuid);
  const cache = {
    refreshedAt: new Date().toISOString(),
    models: [...retained, ...providerModels]
  };
  await writeJsonFile(CONFIG_FILES.modelsCache, cache);
  await removeLegacyModelsCacheFile();
  return cache;
}

export async function getGlobalOpenAIModels() {
  let cache = await readModelsCache();
  const pools = await getProviderPools();
  const enabledProviders = pools.flatMap((pool) => pool.providers).filter((provider) => provider.enabled);
  const cachedProviderIds = new Set(cache.models.map((model) => model.providerUuid));
  const missingProviders = enabledProviders.filter((provider) => !cachedProviderIds.has(provider.uuid));

  for (const provider of missingProviders) {
    try {
      const { response, data } = provider.family === 'openai-custom'
        ? await fetchOpenAIModels(provider)
        : await fetchAnthropicModels(provider);
      if (response.ok) {
        cache = await updateProviderModelsCache(provider, data);
      }
    } catch {
      // Keep serving from available cache data.
    }
  }

  const byModelId = new Map<string, CachedModel>();
  for (const model of cache.models) {
    if (!byModelId.has(model.id)) byModelId.set(model.id, model);
  }
  const mappings = await getModelMappings();
  for (const mapping of mappings) {
    const id = mapping.publicModelName.trim();
    if (!id || byModelId.has(id)) continue;
    byModelId.set(id, {
      id,
      object: 'model',
      owned_by: 'mapping',
      provider: mapping.publicModelName,
      providerFamily: 'openai-custom',
      providerUuid: mapping.id,
      providerCustomName: mapping.publicModelName,
      source: 'manual'
    });
  }
  return {
    object: 'list',
    data: Array.from(byModelId.values()).map((model) => ({
      id: model.id,
      object: model.object,
      owned_by: model.owned_by,
      provider: model.provider
    }))
  };
}

export async function getCachedProviderModels(providerUuid: string) {
  const cache = await readModelsCache();
  return cache.models
    .filter((model) => model.providerUuid === providerUuid)
    .map((model) => ({
      name: model.id,
      source: model.source
    }));
}
