import type { ModelMapping, ProviderFamily } from '@/shared/types';
import { getModelMappings, persistMappingRuntimeState } from '@/server/config/model-mappings-config';
import { getProviderPools } from '@/server/config/provider-pools-config';
import { acquireProviderRateLimit, checkProviderRateLimit, releaseProviderRateLimit } from '@/server/rate-limits/rate-limit-service';

type Provider = Awaited<ReturnType<typeof getProviderPools>>[number]['providers'][number];

export type RouteSelection = {
  mapping: ModelMapping;
  provider: Provider;
  upstreamModelName: string;
  rowId: string;
  rowHealth: string;
  rateLimitAcquired: boolean;
};

export class RouteRateLimitError extends Error {
  retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RouteRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

function isHealthy(value: string) {
  return value === 'healthy' || value === 'unknown';
}

function isDegraded(value: string) {
  return value === 'degraded';
}

function candidateHealth(rowHealth: string, providerHealth: string) {
  if (isHealthy(rowHealth) && isHealthy(providerHealth)) return 'healthy';
  if (isDegraded(rowHealth) || isDegraded(providerHealth)) return 'degraded';
  return 'unavailable';
}

export async function resolveMappedModel(modelAlias: string, preferredFamily?: ProviderFamily): Promise<RouteSelection | null> {
  const mappings = await getModelMappings();
  const mapping = mappings.find((item) => item.publicModelName === modelAlias);
  if (!mapping) return null;

  const providers = (await getProviderPools()).flatMap((pool) => pool.providers);
  const rows = mapping.rows
    .map((row, index) => {
      const provider = providers.find((item) => item.uuid === row.providerUuid || (item.family === row.providerFamily && item.customName === row.providerCustomName));
      return provider ? { row, provider, index, availability: candidateHealth(row.health, provider.health) } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.provider.enabled && (!preferredFamily || item.provider.family === preferredFamily));

  const healthyPool = rows.filter((item) => item.availability === 'healthy');
  const degradedPool = rows.filter((item) => item.availability === 'degraded');
  const candidatePool = healthyPool.length ? healthyPool : degradedPool;
  if (!candidatePool.length) return null;

  const rateLimitChecks = candidatePool.map((item) => ({ item, rateLimit: checkProviderRateLimit(item.provider) }));
  const candidates = rateLimitChecks.filter((entry) => entry.rateLimit.allowed).map((entry) => entry.item);
  if (!candidates.length) {
    const retryAfterMs = Math.min(...rateLimitChecks.map((entry) => entry.rateLimit.retryAfterMs).filter((value) => value > 0));
    throw new RouteRateLimitError(`All providers for model alias are currently rate-limited: ${modelAlias}`, Number.isFinite(retryAfterMs) ? retryAfterMs : 60_000);
  }

  let selected = candidates[0];
  if (mapping.strategy === 'round_robin') {
    const last = Number.isInteger(mapping.lastUsedIndex) ? Number(mapping.lastUsedIndex) : -1;
    const nextOffset = candidates.findIndex((item) => item.index > last);
    selected = nextOffset >= 0 ? candidates[nextOffset] : candidates[0];
  }

  const rateLimit = acquireProviderRateLimit(selected.provider);
  if (!rateLimit.allowed) {
    throw new RouteRateLimitError(rateLimit.reason || `Provider is currently rate-limited: ${selected.provider.customName}`, rateLimit.retryAfterMs || 60_000);
  }

  if (mapping.strategy === 'round_robin') {
    mapping.lastUsedIndex = selected.index;
    await persistMappingRuntimeState(mapping);
  }

  return {
    mapping,
    provider: selected.provider,
    upstreamModelName: selected.row.upstreamModelName,
    rowId: selected.row.id,
    rowHealth: selected.row.health,
    rateLimitAcquired: true
  };
}

export function releaseRouteSelectionRateLimit(selection: RouteSelection) {
  if (!selection.rateLimitAcquired) return;
  releaseProviderRateLimit(selection.provider);
}

export async function markRouteSelectionResult(selection: RouteSelection, status: number) {
  if (!(status >= 200 && status < 300)) return;
  if (selection.rowHealth !== 'degraded') return;
  const nextMapping: ModelMapping = {
    ...selection.mapping,
    rows: selection.mapping.rows.map((row) => (
      row.id === selection.rowId
        ? {
            ...row,
            health: 'healthy',
            lastHealthStatus: status,
            lastHealthCheckedAt: new Date().toISOString(),
            lastHealthResponse: 'Marked healthy after successful routed response.'
          }
        : row
    ))
  };
  await persistMappingRuntimeState(nextMapping);
}
