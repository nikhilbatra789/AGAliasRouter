export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ProviderFamily = 'openai-custom' | 'anthropic-custom';
export type HealthState = 'healthy' | 'degraded' | 'unhealthy' | 'failed' | 'unknown';
export type RoutingStrategy = 'round_robin' | 'ordered';

export type SessionUser = {
  username: string;
  expiresAt: string;
};

export type AppConfig = {
  adminUsername: string;
  sharedApiKey: string;
  sharedApiKeyMasked: string;
  cacheIntervalMinutes: number;
  degradedIntervalMinutes: number;
  unhealthyIntervalMinutes: number;
  healthyModelsIntervalMinutes: number;
  unhealthyModelsIntervalMinutes: number;
  retentionIntervalMinutes: number;
  healthCheckTimeoutSeconds: number;
};

export type DashboardMetrics = {
  providerCounts: Record<ProviderFamily, number>;
  healthyCounts: Record<ProviderFamily, number>;
  unhealthyCount: number;
  unhealthyProviders: Array<{
    uuid: string;
    customName: string;
    family: ProviderFamily;
    health: HealthState;
    lastError?: string;
  }>;
  serviceStartedAt: string;
  serverTime: string;
  nodeVersion: string;
  platform: string;
};

export type ProviderModel = {
  name: string;
  source: 'api' | 'manual';
};

export type Provider = {
  uuid: string;
  providerNumber?: string;
  name: string;
  customName: string;
  family: ProviderFamily;
  enabled: boolean;
  health: HealthState;
  usageCount: number;
  errorCount: number;
  lastUsed: string;
  lastCheck: string;
  lastError?: string;
  checkModelName: string;
  baseUrl: string;
  apiKey?: string;
  apiKeyMasked: string;
  manualModels: string[];
  models: ProviderModel[];
};

export type ProviderPool = {
  family: ProviderFamily;
  label: 'OpenAI' | 'Anthropic';
  providers: Provider[];
};

export type MappingRow = {
  id: string;
  providerFamily: ProviderFamily;
  providerUuid: string;
  providerCustomName: string;
  upstreamModelName: string;
  health: HealthState;
  lastHealthStatus?: number;
  lastHealthResponse?: string;
  lastHealthCheckedAt?: string;
};

export type ModelMapping = {
  id: string;
  publicModelName: string;
  strategy: RoutingStrategy;
  lastUsedIndex?: number;
  rows: MappingRow[];
};

export type CredentialFile = {
  name: string;
  path: string;
  added: string;
  updated: string;
  content: string;
};

export type LogEvent = {
  t: string;
  lvl: 'INFO' | 'WARN' | 'ERROR';
  msg: string;
};
