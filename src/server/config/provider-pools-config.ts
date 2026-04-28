import type { Provider, ProviderPool } from '@/shared/types';
import { randomUUID } from 'node:crypto';
import { CONFIG_FILES } from './paths';
import { readJsonFile, writeJsonFile } from './json-store';
import { maskSecret } from './app-config';
import { getAppConfig, saveAppConfig } from './app-config';

type StoredProvider = Provider & {
  apiKey?: string;
};
type PersistedProvider = Omit<StoredProvider, 'models'>;

export type StoredProviderPool = Omit<ProviderPool, 'providers'> & {
  providers: StoredProvider[];
};

const EMPTY_POOLS: StoredProviderPool[] = [
  { family: 'openai-custom', label: 'OpenAI', providers: [] },
  { family: 'anthropic-custom', label: 'Anthropic', providers: [] }
];

function normalizeProvider(provider: Partial<StoredProvider>, family: StoredProviderPool['family']): StoredProvider {
  const customName = String(provider.customName || provider.name || '').trim();
  const providerNumber = typeof provider.providerNumber === 'string' && /^P\d+$/.test(provider.providerNumber)
    ? provider.providerNumber
    : '';
  return {
    uuid: String(provider.uuid || randomUUID()),
    providerNumber,
    name: String(provider.name || customName),
    customName,
    family,
    enabled: provider.enabled !== false,
    health: provider.health || 'unknown',
    usageCount: Number(provider.usageCount || 0),
    errorCount: Number(provider.errorCount || 0),
    lastUsed: String(provider.lastUsed || 'Never'),
    lastCheck: String(provider.lastCheck || 'Never'),
    lastError: provider.lastError ? String(provider.lastError) : '',
    checkModelName: String(provider.checkModelName || ''),
    baseUrl: String(provider.baseUrl || (family === 'anthropic-custom' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')),
    apiKey: provider.apiKey || '',
    apiKeyMasked: provider.apiKey ? maskSecret(provider.apiKey) : String(provider.apiKeyMasked || ''),
    manualModels: Array.isArray(provider.manualModels) ? provider.manualModels.map(String).filter(Boolean) : [],
    models: []
  };
}

function normalizePools(raw: unknown): StoredProviderPool[] {
  let source: unknown[] = EMPTY_POOLS;

  if (Array.isArray(raw)) {
    source = raw;
  } else if (raw && typeof raw === 'object') {
    const groups = raw as Record<string, unknown>;
    if (!('openai-custom' in groups) || !('anthropic-custom' in groups)) {
      throw new Error(
        `Invalid provider pools in ${CONFIG_FILES.providerPools}: required groups "openai-custom" and "anthropic-custom".`
      );
    }
    if (!Array.isArray(groups['openai-custom']) || !Array.isArray(groups['anthropic-custom'])) {
      throw new Error(
        `Invalid provider pools in ${CONFIG_FILES.providerPools}: both top-level provider groups must be arrays.`
      );
    }
    source = [
      {
        family: 'openai-custom',
        label: 'OpenAI',
        providers: groups['openai-custom']
      },
      {
        family: 'anthropic-custom',
        label: 'Anthropic',
        providers: groups['anthropic-custom']
      }
    ];
  }

  return EMPTY_POOLS.map((emptyPool) => {
    const rawPool = source.find((pool) => pool && typeof pool === 'object' && (pool as { family?: string }).family === emptyPool.family) as Partial<StoredProviderPool> | undefined;
    const providers = Array.isArray(rawPool?.providers) ? rawPool.providers : [];
    return {
      family: emptyPool.family,
      label: emptyPool.label,
      providers: providers.map((provider) => normalizeProvider(provider, emptyPool.family))
    };
  });
}

function hasPersistedModels(raw: unknown) {
  if (!raw || typeof raw !== 'object') return false;
  if (!('openai-custom' in raw) || !('anthropic-custom' in raw)) return false;
  const groups = raw as Record<string, unknown>;
  const providers = [
    ...(Array.isArray(groups['openai-custom']) ? groups['openai-custom'] : []),
    ...(Array.isArray(groups['anthropic-custom']) ? groups['anthropic-custom'] : [])
  ];
  return providers.some((provider) => provider && typeof provider === 'object' && 'models' in (provider as Record<string, unknown>));
}

function toGroupedRecord(pools: StoredProviderPool[]) {
  return {
    'openai-custom': (pools.find((pool) => pool.family === 'openai-custom')?.providers || []).map(({ models: _models, ...provider }) => provider),
    'anthropic-custom': (pools.find((pool) => pool.family === 'anthropic-custom')?.providers || []).map(({ models: _models, ...provider }) => provider)
  } satisfies Record<'openai-custom' | 'anthropic-custom', PersistedProvider[]>;
}

async function ensureProviderNumbers(pools: StoredProviderPool[], existingByUuid?: Map<string, string>) {
  const appConfig = await getAppConfig();
  let providerCounter = appConfig.providerCounter || 0;
  const nextPools = pools.map((pool) => ({
    ...pool,
    providers: pool.providers.map((provider) => {
      const existingNumber = existingByUuid?.get(provider.uuid) || '';
      const assigned = provider.providerNumber || existingNumber;
      if (assigned) {
        const numberPart = Number(assigned.replace(/^P/, ''));
        if (Number.isInteger(numberPart) && numberPart > providerCounter) {
          providerCounter = numberPart;
        }
        return { ...provider, providerNumber: assigned };
      }
      providerCounter += 1;
      return { ...provider, providerNumber: `P${providerCounter}` };
    })
  }));

  if (providerCounter !== appConfig.providerCounter) {
    await saveAppConfig({ ...appConfig, providerCounter });
  }
  return nextPools;
}

export async function getProviderPools(): Promise<StoredProviderPool[]> {
  const raw = await readJsonFile<unknown>(CONFIG_FILES.providerPools);
  const normalized = normalizePools(raw);
  const missing = normalized.some((pool) => pool.providers.some((provider) => !provider.providerNumber));
  const needsStripModels = hasPersistedModels(raw);
  if (!missing && !needsStripModels) return normalized;
  const numbered = await ensureProviderNumbers(normalized);
  await writeJsonFile(CONFIG_FILES.providerPools, toGroupedRecord(numbered));
  return numbered;
}

export async function saveProviderPools(pools: StoredProviderPool[]): Promise<StoredProviderPool[]> {
  const normalized = normalizePools(pools);
  const existingRaw = await readJsonFile<unknown>(CONFIG_FILES.providerPools);
  const existing = normalizePools(existingRaw);
  const existingProviderNumbers = new Map(
    existing.flatMap((pool) => pool.providers).map((provider) => [provider.uuid, provider.providerNumber || ''] as const)
  );
  const nextPools = await ensureProviderNumbers(normalized, existingProviderNumbers);

  for (const pool of nextPools) {
    const seen = new Set<string>();
    for (const provider of pool.providers) {
      if (!provider.customName.trim()) throw new Error('Provider Custom Name is required.');
      const key = provider.customName.toLowerCase();
      if (seen.has(key)) throw new Error(`Provider Custom Name must be unique inside ${pool.family}: ${provider.customName}`);
      seen.add(key);
    }
  }
  await writeJsonFile(CONFIG_FILES.providerPools, toGroupedRecord(nextPools));
  return nextPools;
}

export async function findOpenAIProvider(alias: string): Promise<StoredProvider | null> {
  const pools = await getProviderPools();
  const openaiPool = pools.find((pool) => pool.family === 'openai-custom');
  return openaiPool?.providers.find((provider) => provider.uuid === alias || provider.customName === alias) || null;
}

export async function findAnthropicProvider(alias: string): Promise<StoredProvider | null> {
  const pools = await getProviderPools();
  const anthropicPool = pools.find((pool) => pool.family === 'anthropic-custom');
  return anthropicPool?.providers.find((provider) => provider.uuid === alias || provider.customName === alias) || null;
}
