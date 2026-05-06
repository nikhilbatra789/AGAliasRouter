import type {
  ApiResponse,
  AppConfig,
  CredentialFile,
  DashboardMetrics,
  LogEvent,
  ModelMapping,
  Provider,
  ProviderModel,
  ProviderPool,
  SessionUser
} from '@/shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  if (typeof window !== 'undefined' && window.sessionStorage.getItem('aglias_request_body_logging') === '1') {
    headers.set('x-aglias-log-body', '1');
  }
  const response = await fetch(url, {
    ...init,
    headers
  });
  return response.json();
}

export const adminApi = {
  login(username: string, password: string, next?: string) {
    return request<SessionUser>('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ username, password, next })
    });
  },
  logout() {
    return request<{ ok: true }>('/api/admin/session', { method: 'DELETE' });
  },
  session() {
    return request<SessionUser>('/api/admin/session');
  },
  dashboard() {
    return request<DashboardMetrics>('/api/admin/dashboard');
  },
  config() {
    return request<AppConfig>('/api/admin/config');
  },
  updateConfig(payload: Partial<AppConfig> & { sharedApiKey?: string; adminPassword?: string }) {
    return request<AppConfig>('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  providerPools() {
    return request<ProviderPool[]>('/api/admin/provider-pools');
  },
  providerModels(providerUuid: string) {
    return request<{ providerUuid: string; models: ProviderModel[] }>(`/api/admin/provider-models?providerUuid=${encodeURIComponent(providerUuid)}`);
  },
  fetchProviderModels(provider: Provider) {
    return request<{ providerUuid: string; models: ProviderModel[] }>('/api/admin/provider-models', {
      method: 'POST',
      body: JSON.stringify({ provider })
    });
  },
  saveProviderPools(payload: ProviderPool[]) {
    return request<ProviderPool[]>('/api/admin/provider-pools', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  modelMappings() {
    return request<ModelMapping[]>('/api/admin/model-mappings');
  },
  saveModelMappings(payload: ModelMapping[]) {
    return request<ModelMapping[]>('/api/admin/model-mappings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  credentialFiles() {
    return request<CredentialFile[]>('/api/admin/credential-files');
  },
  deleteCredentialFile(name: string) {
    return request<CredentialFile[]>('/api/admin/credential-files', {
      method: 'DELETE',
      body: JSON.stringify({ name })
    });
  },
  checkHealth(scope: string) {
    return request<{ scope: string; checkedAt: string; pools: ProviderPool[] }>('/api/admin/health-checks', {
      method: 'POST',
      body: JSON.stringify({ scope })
    });
  },
  checkModelHealth(scope: string, modelName: string) {
    return request<{ scope: string; modelName: string; checkedAt: string; health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'; status: number; responseBody: string; pools: ProviderPool[] }>('/api/admin/health-checks', {
      method: 'POST',
      body: JSON.stringify({ scope, modelName })
    });
  },
  logsToday() {
    return request<LogEvent[]>('/api/admin/logs/today');
  }
};
