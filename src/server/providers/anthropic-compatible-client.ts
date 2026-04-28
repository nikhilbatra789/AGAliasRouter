import type { StoredProviderPool } from '@/server/config/provider-pools-config';

type AnthropicProvider = StoredProviderPool['providers'][number];

const ANTHROPIC_VERSION = '2023-06-01';

function joinUrl(baseUrl: string, endpoint: string) {
  const normalized = baseUrl.replace(/\/+$/, '');
  const apiBase = normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
  return `${apiBase}/${endpoint.replace(/^\/+/, '')}`;
}

function createAnthropicHeaders(provider: AnthropicProvider) {
  return {
    'x-api-key': provider.apiKey || '',
    'anthropic-version': ANTHROPIC_VERSION,
    'Content-Type': 'application/json'
  };
}

export async function fetchAnthropicModels(provider: AnthropicProvider) {
  const response = await fetch(joinUrl(provider.baseUrl, '/models'), {
    method: 'GET',
    headers: createAnthropicHeaders(provider)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { response, data };
  }

  const manual = provider.manualModels.map((name) => ({
    id: name,
    type: 'model',
    display_name: name,
    created_at: 'manual',
    owned_by: 'manual'
  }));
  const existing = Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: unknown[] }).data : [];
  const existingIds = new Set(
    existing
      .map((entry) => (entry && typeof entry === 'object' ? (entry as { id?: string }).id : undefined))
      .filter((id): id is string => Boolean(id))
  );

  return {
    response,
    data: {
      ...data,
      data: [
        ...existing,
        ...manual.filter((model) => !existingIds.has(model.id))
      ]
    }
  };
}

export async function createAnthropicMessage(provider: AnthropicProvider, body: unknown, init?: RequestInit) {
  const response = await fetch(joinUrl(provider.baseUrl, '/messages'), {
    ...init,
    method: 'POST',
    headers: createAnthropicHeaders(provider),
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
