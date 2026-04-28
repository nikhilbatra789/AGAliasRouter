import type { AppConfig, CredentialFile, DashboardMetrics, LogEvent, ModelMapping, ProviderPool } from './types';

export const mockAppConfig: AppConfig = {
  adminUsername: 'admin@gmail.com',
  sharedApiKey: 'sk-123456',
  sharedApiKeyMasked: 'sk-123456'.replace(/.(?=.{4})/g, '•'),
  cacheIntervalMinutes: 15,
  degradedIntervalMinutes: 15,
  unhealthyIntervalMinutes: 60,
  healthyModelsIntervalMinutes: 360,
  unhealthyModelsIntervalMinutes: 15,
  retentionIntervalMinutes: 60,
  healthCheckTimeoutSeconds: 60
};

export const mockDashboardMetrics: DashboardMetrics = {
  providerCounts: {
    'openai-custom': 3,
    'anthropic-custom': 3
  },
  healthyCounts: {
    'openai-custom': 2,
    'anthropic-custom': 2
  },
  unhealthyCount: 2,
  serviceStartedAt: '2026-04-20T08:14:33Z',
  serverTime: new Date().toISOString(),
  nodeVersion: 'v22.14.0',
  platform: 'darwin · arm64'
};

export const mockProviderPools: ProviderPool[] = [
  {
    family: 'openai-custom',
    label: 'OpenAI',
    providers: [
      {
        uuid: 'a2091672-db54-49e8-a8f9-e990d9d311fb',
        name: 'openai-gpt4o-primary',
        customName: 'openai-gpt4o-primary',
        family: 'openai-custom',
        enabled: true,
        health: 'healthy',
        usageCount: 29031,
        errorCount: 0,
        lastUsed: '4/24/2026, 1:22:04 PM',
        lastCheck: '4/24/2026, 1:22:04 PM',
        checkModelName: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyMasked: 'sk-••••••••••••',
        manualModels: ['gpt-4o-manual'],
        models: [
          { name: 'gpt-4o', source: 'api' },
          { name: 'gpt-4o-mini', source: 'api' },
          { name: 'gpt-4o-manual', source: 'manual' }
        ]
      },
      {
        uuid: 'b4f72810-cc21-4a1e-9d3f-1a2b3c4d5e6f',
        name: 'openai-o3-secondary',
        customName: 'openai-o3-secondary',
        family: 'openai-custom',
        enabled: true,
        health: 'healthy',
        usageCount: 8412,
        errorCount: 2,
        lastUsed: '4/24/2026, 1:18:41 PM',
        lastCheck: '4/24/2026, 1:20:00 PM',
        checkModelName: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyMasked: 'sk-••••••••••••',
        manualModels: ['o3-manual'],
        models: [
          { name: 'o3', source: 'api' },
          { name: 'o3-mini', source: 'api' },
          { name: 'o3-manual', source: 'manual' }
        ]
      },
      {
        uuid: 'c9e83721-aa10-4b2d-8e5f-2c3d4e5f6a7b',
        name: 'openai-gpt4o-fallback',
        customName: 'openai-gpt4o-fallback',
        family: 'openai-custom',
        enabled: false,
        health: 'degraded',
        usageCount: 3029,
        errorCount: 14,
        lastUsed: '4/24/2026, 11:05:12 AM',
        lastCheck: '4/24/2026, 1:21:50 PM',
        checkModelName: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyMasked: 'sk-••••••••••••',
        manualModels: [],
        models: [{ name: 'gpt-4o', source: 'api' }]
      }
    ]
  },
  {
    family: 'anthropic-custom',
    label: 'Anthropic',
    providers: [
      {
        uuid: 'd1f94832-bb22-4c3e-9f60-3d4e5f6a7b8c',
        name: 'anthropic-claude4-primary',
        customName: 'anthropic-claude4-primary',
        family: 'anthropic-custom',
        enabled: true,
        health: 'healthy',
        usageCount: 18204,
        errorCount: 0,
        lastUsed: '4/24/2026, 1:21:58 PM',
        lastCheck: '4/24/2026, 1:22:01 PM',
        checkModelName: 'claude-3-5-haiku-latest',
        baseUrl: 'https://api.anthropic.com',
        apiKeyMasked: 'sk-ant-••••••••',
        manualModels: ['claude-sonnet-manual'],
        models: [{ name: 'claude-sonnet-manual', source: 'manual' }]
      },
      {
        uuid: 'e2a05943-cc33-4d4f-a071-4e5f6a7b8c9d',
        name: 'anthropic-claude-sonnet-backup',
        customName: 'anthropic-claude-sonnet-backup',
        family: 'anthropic-custom',
        enabled: true,
        health: 'healthy',
        usageCount: 6741,
        errorCount: 1,
        lastUsed: '4/24/2026, 12:54:20 PM',
        lastCheck: '4/24/2026, 1:21:45 PM',
        checkModelName: 'claude-3-5-haiku-latest',
        baseUrl: 'https://api.anthropic.com',
        apiKeyMasked: 'sk-ant-••••••••',
        manualModels: ['claude-3-5-sonnet-latest'],
        models: [{ name: 'claude-3-5-sonnet-latest', source: 'manual' }]
      },
      {
        uuid: 'f3b16054-dd44-4e5f-b182-5f6a7b8c9d0e',
        name: 'anthropic-claude-opus-canary',
        customName: 'anthropic-claude-opus-canary',
        family: 'anthropic-custom',
        enabled: false,
        health: 'failed',
        usageCount: 312,
        errorCount: 47,
        lastUsed: '4/24/2026, 9:12:03 AM',
        lastCheck: '4/24/2026, 1:21:30 PM',
        checkModelName: 'claude-3-5-haiku-latest',
        baseUrl: 'https://api.anthropic.com',
        apiKeyMasked: 'sk-ant-••••••••',
        manualModels: ['claude-opus-4-6'],
        models: [{ name: 'claude-opus-4-6', source: 'manual' }]
      }
    ]
  }
];

export const mockModelMappings: ModelMapping[] = [
  {
    id: 'map-claude-opus',
    publicModelName: 'ai-claude-opus-4-5',
    strategy: 'round_robin',
    rows: [
      {
        id: 'row-1',
        providerFamily: 'openai-custom',
        providerUuid: 'a2091672-db54-49e8-a8f9-e990d9d311fb',
        providerCustomName: 'openai-gpt4o-primary',
        upstreamModelName: 'gpt-4o',
        health: 'healthy'
      },
      {
        id: 'row-2',
        providerFamily: 'anthropic-custom',
        providerUuid: 'd1f94832-bb22-4c3e-9f60-3d4e5f6a7b8c',
        providerCustomName: 'anthropic-claude4-primary',
        upstreamModelName: 'claude-sonnet-manual',
        health: 'degraded'
      }
    ]
  }
];

export const mockCredentialFiles: CredentialFile[] = [
  {
    name: 'app_config.json',
    path: 'config/app_config.json',
    added: '2026-04-01',
    updated: '2026-04-26',
    content: '{\n  "email": "admin@gmail.com",\n  "password": "123456",\n  "apiKey": "sk-123456"\n}'
  },
  {
    name: 'provider_pools.json',
    path: 'config/provider_pools.json',
    added: '2026-02-11',
    updated: '2026-04-02',
    content: '{\n  "openai-custom": [],\n  "anthropic-custom": []\n}'
  },
  {
    name: 'model_mappings.json',
    path: 'config/model_mappings.json',
    added: '2026-01-09',
    updated: '2026-03-28',
    content: '{\n  "mappings": []\n}'
  },
  {
    name: 'model_cache.json',
    path: 'config/model_cache.json',
    added: '2026-03-14',
    updated: '2026-04-18',
    content: '{\n  "providers": {}\n}'
  },
  {
    name: 'codex_headers_fallback.json',
    path: 'config/codex_headers_fallback.json',
    added: '2026-04-12',
    updated: '2026-04-20',
    content: '{\n  "Authorization": "Bearer [redacted]"\n}'
  }
];

export const mockLogs: LogEvent[] = [
  { t: '14:02:11.442', lvl: 'INFO', msg: 'route.match alias=gpt-5-fast pool=openai-custom provider=openai-gpt4o-primary' },
  { t: '14:02:11.501', lvl: 'INFO', msg: 'upstream.request provider=openai-gpt4o-primary model=gpt-4o apiKey=[redacted]' },
  { t: '14:02:11.588', lvl: 'INFO', msg: 'upstream.response status=200 tokens=1842 p95=87ms' },
  { t: '14:02:12.011', lvl: 'WARN', msg: 'provider.degraded provider=openai-gpt4o-fallback retry_after=2s' },
  { t: '14:02:12.140', lvl: 'INFO', msg: 'route.match alias=claude-sonnet pool=anthropic-custom provider=anthropic-claude4-primary' },
  { t: '14:02:12.270', lvl: 'ERROR', msg: 'upstream.auth provider=openai-o3-secondary status=401 apiKey=[redacted]' },
  { t: '14:02:15.640', lvl: 'WARN', msg: 'pool.failover from=openai-gpt4o-fallback to=openai-gpt4o-primary degradedFallback=true' },
  { t: '14:02:17.870', lvl: 'INFO', msg: 'health.recovered provider=openai-gpt4o-primary result=healthy' },
  { t: '14:02:22.510', lvl: 'ERROR', msg: 'upstream.rate_limit provider=anthropic-claude-opus-canary status=429' }
];
