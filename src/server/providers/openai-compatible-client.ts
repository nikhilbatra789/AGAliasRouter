import type { StoredProviderPool } from '@/server/config/provider-pools-config';

type OpenAIProvider = StoredProviderPool['providers'][number];

function joinUrl(baseUrl: string, endpoint: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
}

function extractOpenAIModelRows(data: unknown): Array<Record<string, unknown>> {
  const normalizeRow = (row: unknown): Record<string, unknown> | null => {
    if (!row) return null;
    if (typeof row === 'string') {
      const id = row.trim();
      if (!id) return null;
      return { id, object: 'model' };
    }
    if (typeof row !== 'object') return null;
    const entry = row as { id?: unknown; name?: unknown; model?: unknown };
    const idCandidate = typeof entry.id === 'string'
      ? entry.id
      : typeof entry.name === 'string'
        ? entry.name
        : typeof entry.model === 'string'
          ? entry.model
          : '';
    const id = idCandidate.trim();
    if (!id) return null;
    return { ...(row as Record<string, unknown>), id };
  };

  const candidates =
    Array.isArray(data)
      ? data
      : data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)
        ? (data as { data: unknown[] }).data
        : data && typeof data === 'object' && Array.isArray((data as { models?: unknown[] }).models)
          ? (data as { models: unknown[] }).models
          : [];

  return candidates
    .map(normalizeRow)
    .filter((row): row is Record<string, unknown> => row !== null);
}

export async function fetchOpenAIModels(provider: OpenAIProvider) {
  const response = await fetch(joinUrl(provider.baseUrl, '/models'), {
    headers: {
      Authorization: `Bearer ${provider.apiKey || ''}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { response, data };
  }

  const manual = provider.manualModels.map((name) => ({ id: name, object: 'model', owned_by: 'manual' }));
  const existing = extractOpenAIModelRows(data);
  const existingIds = new Set(
    existing
      .map((model) => (typeof model.id === 'string' ? model.id.trim() : ''))
      .filter(Boolean)
  );
  const merged = [...existing, ...manual.filter((model) => !existingIds.has(model.id))];

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return {
      response,
      data: {
        ...(data as Record<string, unknown>),
        object: typeof (data as { object?: unknown }).object === 'string' ? (data as { object: string }).object : 'list',
        data: merged
      }
    };
  }

  return {
    response,
    data: {
      object: 'list',
      data: merged
    }
  };
}

export async function createOpenAIChatCompletion(provider: OpenAIProvider, body: unknown, init?: RequestInit) {
  const response = await fetch(joinUrl(provider.baseUrl, '/chat/completions'), {
    ...init,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey || ''}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
