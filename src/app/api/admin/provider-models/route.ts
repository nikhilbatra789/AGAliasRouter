import { NextResponse } from 'next/server';
import { getProviderPools } from '@/server/config/provider-pools-config';
import { fetchAnthropicModels } from '@/server/providers/anthropic-compatible-client';
import { fetchOpenAIModels } from '@/server/providers/openai-compatible-client';
import { uiError } from '@/server/errors/api-errors';
import { getCachedProviderModels, updateProviderModelsCache } from '@/server/models/models-cache-service';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';
import type { ProviderModel } from '@/shared/types';

export const runtime = 'nodejs';

function parseModels(data: unknown): ProviderModel[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)
      ? (data as { data: unknown[] }).data
      : data && typeof data === 'object' && Array.isArray((data as { models?: unknown }).models)
        ? (data as { models: unknown[] }).models
        : [];

  const models = rows
    .map((row) => {
      const entry = typeof row === 'string'
        ? { id: row, owned_by: 'api' }
        : row && typeof row === 'object'
          ? row as { id?: unknown; name?: unknown; model?: unknown; owned_by?: unknown }
          : null;
      if (!entry) return null;
      const nameCandidate = typeof entry.id === 'string'
        ? entry.id
        : typeof entry.name === 'string'
          ? entry.name
          : typeof entry.model === 'string'
            ? entry.model
            : '';
      const name = nameCandidate.trim();
      if (!name) return null;
      return {
        name,
        source: entry.owned_by === 'manual' ? 'manual' : 'api'
      } satisfies ProviderModel;
    })
    .filter((model): model is ProviderModel => Boolean(model));

  return Array.from(new Map(models.map((model) => [model.name, model])).values());
}

export async function GET(request: Request) {
  try {
    ensureRuntimeJobs();
    const providerUuid = new URL(request.url).searchParams.get('providerUuid') || '';
    if (!providerUuid) {
      return uiError(new Error('providerUuid is required.'), 400);
    }

    const pools = await getProviderPools();
    const provider = pools.flatMap((pool) => pool.providers).find((item) => item.uuid === providerUuid);
    if (!provider) {
      return uiError(new Error('Provider was not found.'), 404);
    }

    const { response, data } = provider.family === 'anthropic-custom'
      ? await fetchAnthropicModels(provider)
      : await fetchOpenAIModels(provider);

    if (!response.ok) {
      const cached = await getCachedProviderModels(provider.uuid);
      const manualOnly = provider.manualModels.map((name) => ({ name, source: 'manual' as const }));
      const fallback = Array.from(
        new Map([...cached, ...manualOnly].map((model) => [model.name, model])).values()
      );
      if (fallback.length > 0) {
        return NextResponse.json({ ok: true, data: { providerUuid, models: fallback } });
      }
      return NextResponse.json({ ok: false, error: { code: 'provider_models_error', message: 'Unable to load provider models.', details: data } }, { status: response.status });
    }

    const models = parseModels(data);
    await updateProviderModelsCache(provider, data);

    return NextResponse.json({ ok: true, data: { providerUuid, models } });
  } catch (error) {
    return uiError(error);
  }
}
