import { NextResponse } from 'next/server';
import { getProviderPools } from '@/server/config/provider-pools-config';
import { fetchAnthropicModels } from '@/server/providers/anthropic-compatible-client';
import { fetchOpenAIModels } from '@/server/providers/openai-compatible-client';
import { uiError } from '@/server/errors/api-errors';
import { getCachedProviderModels, updateProviderModelsCache } from '@/server/models/models-cache-service';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';
import type { Provider, ProviderModel } from '@/shared/types';

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

function normalizeFormProvider(provider?: Provider): Provider | null {
  if (!provider) return null;
  return {
    ...provider,
    customName: String(provider.customName || 'Pending Provider').trim() || 'Pending Provider',
    name: String(provider.name || provider.customName || 'Pending Provider').trim() || 'Pending Provider',
    baseUrl: String(provider.baseUrl || '').trim(),
    apiKey: String(provider.apiKey || '').trim(),
    manualModels: Array.isArray(provider.manualModels) ? provider.manualModels.map(String).filter(Boolean) : [],
    models: []
  };
}

export async function POST(request: Request) {
  try {
    ensureRuntimeJobs();
    const body = await request.json().catch(() => ({}));
    const provider = normalizeFormProvider((body as { provider?: Provider }).provider);

    if (!provider?.uuid) {
      return uiError(new Error('provider.uuid is required.'), 400);
    }
    if (!provider.baseUrl) {
      return uiError(new Error('Base URL is required.'), 400);
    }
    if (!provider.apiKey) {
      return uiError(new Error('API Key is required.'), 400);
    }

    const { response, data } = provider.family === 'anthropic-custom'
      ? await fetchAnthropicModels(provider)
      : await fetchOpenAIModels(provider);

    if (!response.ok) {
      return NextResponse.json({ ok: false, error: { code: 'provider_models_error', message: 'Unable to load provider models.', details: data } }, { status: response.status });
    }

    const cache = await updateProviderModelsCache(provider, data);
    const models = cache.models
      .filter((model) => model.providerUuid === provider.uuid)
      .map((model) => ({ name: model.id, source: model.source }));

    return NextResponse.json({ ok: true, data: { providerUuid: provider.uuid, models } });
  } catch (error) {
    return uiError(error);
  }
}
