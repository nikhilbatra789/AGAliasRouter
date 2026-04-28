import type { ModelMapping, RoutingStrategy } from '@/shared/types';
import { randomUUID } from 'node:crypto';
import { CONFIG_FILES } from './paths';
import { readJsonFile, writeJsonFile } from './json-store';

const SUPPORTED_STRATEGIES = new Set<RoutingStrategy>(['round_robin', 'ordered']);
const SUPPORTED_HEALTH = new Set<ModelMapping['rows'][number]['health']>(['healthy', 'degraded', 'unhealthy', 'failed', 'unknown']);

function normalizeHealth(value: unknown): ModelMapping['rows'][number]['health'] {
  return typeof value === 'string' && SUPPORTED_HEALTH.has(value as ModelMapping['rows'][number]['health'])
    ? (value as ModelMapping['rows'][number]['health'])
    : 'unknown';
}

function normalizeRowHealth(row: Partial<ModelMapping['rows'][number]>) {
  const health = normalizeHealth(row.health);
  const response = typeof row.lastHealthResponse === 'string' ? row.lastHealthResponse.toLowerCase() : '';
  const status = Number.isInteger(row.lastHealthStatus) ? row.lastHealthStatus : undefined;
  const transientFailure =
    health === 'unhealthy' &&
    (status === 408 || status === 500) &&
    (
      response.includes('fetch failed') ||
      response.includes('timeout') ||
      response.includes('timed out') ||
      response.includes('aborted')
    );
  return transientFailure ? 'degraded' : health;
}

function normalizeMapping(raw: Partial<ModelMapping>): ModelMapping {
  const strategy = raw.strategy && SUPPORTED_STRATEGIES.has(raw.strategy) ? raw.strategy : 'round_robin';
  return {
    id: String(raw.id || randomUUID()),
    publicModelName: String(raw.publicModelName || '').trim(),
    strategy,
    lastUsedIndex: Number.isInteger(raw.lastUsedIndex) ? raw.lastUsedIndex : -1,
    rows: Array.isArray(raw.rows)
      ? raw.rows.map((row) => ({
          id: String(row.id || randomUUID()),
          providerFamily: row.providerFamily,
          providerUuid: String(row.providerUuid || ''),
          providerCustomName: String(row.providerCustomName || ''),
          upstreamModelName: String(row.upstreamModelName || ''),
          health: normalizeRowHealth(row),
          lastHealthStatus: Number.isInteger(row.lastHealthStatus) ? row.lastHealthStatus : undefined,
          lastHealthResponse: typeof row.lastHealthResponse === 'string' ? row.lastHealthResponse : undefined,
          lastHealthCheckedAt: typeof row.lastHealthCheckedAt === 'string' ? row.lastHealthCheckedAt : undefined
        }))
      : []
  };
}

export async function getModelMappings(): Promise<ModelMapping[]> {
  const raw = await readJsonFile<unknown>(CONFIG_FILES.modelMappings);
  if (!raw) return [];
  const mappings = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? (raw as { mappings?: unknown }).mappings : []);
  if (!Array.isArray(mappings)) {
    throw new Error(`Invalid model mappings in ${CONFIG_FILES.modelMappings}: expected array or { mappings: [] }.`);
  }
  return mappings.map((mapping) => normalizeMapping(mapping as Partial<ModelMapping>));
}

export async function saveModelMappings(mappings: ModelMapping[]): Promise<ModelMapping[]> {
  const normalized = mappings.map((mapping) => normalizeMapping(mapping));
  for (const mapping of normalized) {
    if (!mapping.publicModelName) throw new Error('Public model alias is required.');
    if (!SUPPORTED_STRATEGIES.has(mapping.strategy)) throw new Error(`Unsupported routing strategy: ${mapping.strategy}`);
  }
  await writeJsonFile(CONFIG_FILES.modelMappings, { mappings: normalized });
  return normalized;
}

export async function persistMappingRuntimeState(mapping: ModelMapping) {
  const mappings = await getModelMappings();
  await saveModelMappings(mappings.map((item) => (item.id === mapping.id ? mapping : item)));
}
