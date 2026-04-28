import { checkModelMappingsByHealth, checkProvidersByHealth } from '@/server/health/health-check-service';
import { pruneOldLogs } from '@/server/logging/log-service';
import { refreshModelsCache } from '@/server/models/models-cache-service';
import { setServiceStartedAt } from '@/server/dashboard/dashboard-service';
import { DEFAULT_APP_CONFIG, getAppConfig } from '@/server/config/app-config';

declare global {
  var __aglias_runtime_initialized__: boolean | undefined;
}

let degradedInterval: NodeJS.Timeout | null = null;
let unhealthyInterval: NodeJS.Timeout | null = null;
let healthyModelsInterval: NodeJS.Timeout | null = null;
let unhealthyModelsInterval: NodeJS.Timeout | null = null;
let cacheInterval: NodeJS.Timeout | null = null;
let retentionInterval: NodeJS.Timeout | null = null;
let runtimeJobsBootPromise: Promise<void> | null = null;

function clearRuntimeIntervals() {
  if (degradedInterval) clearInterval(degradedInterval);
  if (unhealthyInterval) clearInterval(unhealthyInterval);
  if (healthyModelsInterval) clearInterval(healthyModelsInterval);
  if (unhealthyModelsInterval) clearInterval(unhealthyModelsInterval);
  if (cacheInterval) clearInterval(cacheInterval);
  if (retentionInterval) clearInterval(retentionInterval);
  degradedInterval = null;
  unhealthyInterval = null;
  healthyModelsInterval = null;
  unhealthyModelsInterval = null;
  cacheInterval = null;
  retentionInterval = null;
}

async function bootRuntimeJobs() {
  const config = await getAppConfig().catch(() => DEFAULT_APP_CONFIG);
  const minute = 60 * 1000;
  const cacheMs = config.cacheIntervalMinutes * minute;
  const degradedMs = config.degradedIntervalMinutes * minute;
  const unhealthyMs = config.unhealthyIntervalMinutes * minute;
  const healthyModelsMs = config.healthyModelsIntervalMinutes * minute;
  const unhealthyModelsMs = config.unhealthyModelsIntervalMinutes * minute;
  const retentionMs = config.retentionIntervalMinutes * minute;

  clearRuntimeIntervals();

  void refreshModelsCache().catch(() => null);
  void pruneOldLogs().catch(() => null);
  void checkProvidersByHealth(['degraded']).catch(() => null);
  void checkProvidersByHealth(['unhealthy', 'failed']).catch(() => null);

  cacheInterval = setInterval(() => {
    void refreshModelsCache().catch(() => null);
  }, cacheMs);

  degradedInterval = setInterval(() => {
    void checkProvidersByHealth(['degraded']).catch(() => null);
  }, degradedMs);

  unhealthyInterval = setInterval(() => {
    void checkProvidersByHealth(['unhealthy', 'failed']).catch(() => null);
  }, unhealthyMs);

  healthyModelsInterval = setInterval(() => {
    void checkModelMappingsByHealth(['healthy']).catch(() => null);
  }, healthyModelsMs);

  unhealthyModelsInterval = setInterval(() => {
    void checkModelMappingsByHealth(['unhealthy', 'failed']).catch(() => null);
  }, unhealthyModelsMs);

  retentionInterval = setInterval(() => {
    void pruneOldLogs().catch(() => null);
  }, retentionMs);
}

export function ensureRuntimeJobs() {
  if (globalThis.__aglias_runtime_initialized__) return;
  if (runtimeJobsBootPromise) return;
  globalThis.__aglias_runtime_initialized__ = true;
  setServiceStartedAt(new Date().toISOString());
  runtimeJobsBootPromise = bootRuntimeJobs().finally(() => {
    runtimeJobsBootPromise = null;
  });
}

export async function reloadRuntimeJobs() {
  if (runtimeJobsBootPromise) await runtimeJobsBootPromise;
  if (!globalThis.__aglias_runtime_initialized__) {
    ensureRuntimeJobs();
    if (runtimeJobsBootPromise) await runtimeJobsBootPromise;
    return;
  }
  await bootRuntimeJobs();
}

export function stopRuntimeJobs() {
  clearRuntimeIntervals();
  globalThis.__aglias_runtime_initialized__ = false;
  runtimeJobsBootPromise = null;
}
