import { getProviderPools } from '@/server/config/provider-pools-config';
import type { DashboardMetrics, ProviderFamily } from '@/shared/types';

let serviceStartedAt = new Date().toISOString();

export function getServiceStartedAt() {
  return serviceStartedAt;
}

export function setServiceStartedAt(value: string) {
  serviceStartedAt = value;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const pools = await getProviderPools();
  const providerCounts: Record<ProviderFamily, number> = {
    'openai-custom': 0,
    'anthropic-custom': 0
  };
  const healthyCounts: Record<ProviderFamily, number> = {
    'openai-custom': 0,
    'anthropic-custom': 0
  };

  let unhealthyCount = 0;
  const unhealthyProviders: DashboardMetrics['unhealthyProviders'] = [];
  for (const pool of pools) {
    providerCounts[pool.family] += pool.providers.length;
    for (const provider of pool.providers) {
      const healthy = provider.enabled && (provider.health === 'healthy' || provider.health === 'unknown');
      if (healthy) {
        healthyCounts[pool.family] += 1;
      } else if (provider.enabled) {
        unhealthyCount += 1;
        unhealthyProviders.push({
          uuid: provider.uuid,
          customName: provider.customName,
          family: provider.family,
          health: provider.health,
          lastError: provider.lastError
        });
      }
    }
  }

  return {
    providerCounts,
    healthyCounts,
    unhealthyCount,
    unhealthyProviders,
    serviceStartedAt,
    serverTime: new Date().toISOString(),
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`
  };
}
