import { getProviderPools, saveProviderPools } from '@/server/config/provider-pools-config';
import { getModelMappings, saveModelMappings } from '@/server/config/model-mappings-config';
import { getAppConfig } from '@/server/config/app-config';
import { createAnthropicMessage } from '@/server/providers/anthropic-compatible-client';
import { createOpenAIChatCompletion } from '@/server/providers/openai-compatible-client';
import { appendLog } from '@/server/logging/log-service';
import type { HealthState, ProviderPool } from '@/shared/types';

type HealthScope = 'all' | string;

function hasErrorFinishReason(data: unknown) {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if (record.error) return true;
  if (typeof record.stop_reason === 'string' && record.stop_reason.toLowerCase() === 'error') return true;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  return choices.some((choice) => {
    if (!choice || typeof choice !== 'object') return false;
    const finishReason = (choice as { finish_reason?: unknown }).finish_reason;
    return typeof finishReason === 'string' && finishReason.toLowerCase() === 'error';
  });
}

function classifyStatus(status: number, data: unknown): HealthState {
  if (status >= 200 && status < 300 && hasErrorFinishReason(data)) return 'unhealthy';
  if (status >= 200 && status < 300) return 'healthy';
  if (status === 429 || status === 408) return 'degraded';
  return 'unhealthy';
}

function classifyModelStatus(status: number, data: unknown): HealthState {
  if (status === 429 || status === 408) return 'degraded';
  if (status >= 200 && status < 300 && hasErrorFinishReason(data)) return 'unhealthy';
  if (status >= 200 && status < 300) {
    const nonEmpty =
      typeof data === 'string'
        ? data.trim().length > 0
        : Array.isArray(data)
          ? data.length > 0
          : data && typeof data === 'object'
            ? Object.keys(data as Record<string, unknown>).length > 0
            : Boolean(data);
    return nonEmpty ? 'healthy' : 'unhealthy';
  }
  return 'unhealthy';
}

function isTransientNetworkError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('network') ||
    message.includes('econn') ||
    message.includes('enotfound')
  );
}

function stringifyErrorPayload(data: unknown) {
  if (typeof data === 'string') return data.trim();
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  const nested = record.error;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  if (nested && typeof nested === 'object') {
    const nestedRecord = nested as Record<string, unknown>;
    const message = nestedRecord.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  const message = record.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue;
    const choiceRecord = choice as Record<string, unknown>;
    const finishReason = choiceRecord.finish_reason;
    const messageRecord = choiceRecord.message && typeof choiceRecord.message === 'object'
      ? choiceRecord.message as Record<string, unknown>
      : null;
    const content = messageRecord?.content;
    if (typeof finishReason === 'string' && finishReason.toLowerCase() === 'error' && typeof content === 'string' && content.trim()) {
      return content.trim();
    }
  }
  try {
    return JSON.stringify(data).slice(0, 1200);
  } catch {
    return '';
  }
}

function timeoutSignal(timeoutMs: number) {
  return { signal: AbortSignal.timeout(timeoutMs) };
}

async function getHealthCheckTimeoutMs() {
  const config = await getAppConfig();
  return config.healthCheckTimeoutSeconds * 1000;
}

async function runProviderCheck(provider: ProviderPool['providers'][number], checkedAt: string, timeoutMs: number) {
  if (!provider.enabled) {
    return { ...provider, health: 'unknown' as const, lastCheck: checkedAt, lastError: '' };
  }

  if (!provider.checkModelName.trim()) {
    return {
      ...provider,
      health: 'unhealthy' as const,
      errorCount: provider.errorCount + 1,
      lastCheck: checkedAt,
      lastError: 'Health Check Model is required.'
    };
  }

  try {
    const result = provider.family === 'anthropic-custom'
      ? await createAnthropicMessage(
          provider,
          {
            model: provider.checkModelName,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }]
          },
          timeoutSignal(timeoutMs)
        )
      : await createOpenAIChatCompletion(
          provider,
          {
            model: provider.checkModelName,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1,
            temperature: 0
          },
          timeoutSignal(timeoutMs)
        );

    const nextHealth = classifyStatus(result.response.status, result.data);
    const errorMessage = nextHealth === 'healthy'
      ? ''
      : stringifyErrorPayload(result.data) || `HTTP ${result.response.status}`;
    await appendLog('INFO', `health.check provider=${provider.customName} status=${result.response.status} health=${nextHealth}`);
    return {
      ...provider,
      health: nextHealth,
      errorCount: nextHealth === 'healthy' ? provider.errorCount : provider.errorCount + 1,
      lastCheck: checkedAt,
      lastError: errorMessage
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendLog('WARN', `health.check provider=${provider.customName} failed=${error instanceof Error ? error.message : String(error)}`);
    return {
      ...provider,
      health: 'degraded' as const,
      errorCount: provider.errorCount + 1,
      lastCheck: checkedAt,
      lastError: message
    };
  }
}

async function runModelCheck(
  provider: ProviderPool['providers'][number],
  modelName: string,
  checkedAt: string,
  timeoutMs: number
): Promise<{ health: HealthState; status: number; responseBody: string; checkedAt: string }> {
  if (!provider.enabled) {
    return {
      health: 'unknown',
      status: 0,
      responseBody: 'Provider is disabled.',
      checkedAt
    };
  }

  try {
    const result = provider.family === 'anthropic-custom'
      ? await createAnthropicMessage(
          provider,
          {
            model: modelName,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }]
          },
          timeoutSignal(timeoutMs)
        )
      : await createOpenAIChatCompletion(
          provider,
          {
            model: modelName,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1,
            temperature: 0
          },
          timeoutSignal(timeoutMs)
        );

    const health = classifyModelStatus(result.response.status, result.data);
    await appendLog('INFO', `health.model provider=${provider.customName} model=${modelName} status=${result.response.status} health=${health}`);
    const responseBody = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    return {
      health,
      status: result.response.status,
      responseBody: responseBody.slice(0, 8000),
      checkedAt
    };
  } catch (error) {
    await appendLog('WARN', `health.model provider=${provider.customName} model=${modelName} failed=${error instanceof Error ? error.message : String(error)}`);
    return {
      health: isTransientNetworkError(error) ? 'degraded' : 'unhealthy',
      status: isTransientNetworkError(error) ? 408 : 500,
      responseBody: error instanceof Error ? error.message : String(error),
      checkedAt
    };
  }
}

export async function checkProviders(scope: HealthScope) {
  const checkedAt = new Date().toLocaleString();
  const timeoutMs = await getHealthCheckTimeoutMs();
  const pools = await getProviderPools();
  const nextPools: ProviderPool[] = [];

  for (const pool of pools) {
    const nextProviders = [];
    for (const provider of pool.providers) {
      const matchesScope =
        scope === 'all' ||
        scope === provider.uuid ||
        scope === provider.customName ||
        (scope === 'unhealthy' && provider.enabled && provider.health !== 'healthy' && provider.health !== 'unknown');
      if (matchesScope) {
        nextProviders.push(await runProviderCheck(provider, checkedAt, timeoutMs));
      } else {
        nextProviders.push(provider);
      }
    }
    nextPools.push({ ...pool, providers: nextProviders });
  }

  const saved = await saveProviderPools(nextPools);
  return {
    scope,
    checkedAt,
    pools: saved
  };
}

export async function checkProvidersByHealth(target: Array<HealthState>) {
  const pools = await getProviderPools();
  const ids = pools.flatMap((pool) => pool.providers).filter((provider) => target.includes(provider.health)).map((provider) => provider.uuid);
  if (!ids.length) return null;
  const checkedAt = new Date().toLocaleString();
  let nextPools: ProviderPool[] = pools;

  for (const id of ids) {
    const refreshed = await checkProviders(id);
    nextPools = refreshed.pools;
  }

  return { checkedAt, pools: nextPools, checked: ids.length };
}

export async function checkProviderModel(scope: string, modelName: string) {
  const checkedAt = new Date().toLocaleString();
  const timeoutMs = await getHealthCheckTimeoutMs();
  const pools = await getProviderPools();
  const provider = pools
    .flatMap((pool) => pool.providers)
    .find((item) => scope === item.uuid || scope === item.customName);

  if (!provider) {
    throw new Error('Provider was not found.');
  }

  const result = await runModelCheck(provider, modelName, checkedAt, timeoutMs);
  return {
    scope,
    modelName,
    checkedAt,
    health: result.health,
    status: result.status,
    responseBody: result.responseBody,
    pools
  };
}

export async function checkModelMappingsByHealth(target: Array<HealthState>) {
  const checkedAt = new Date().toLocaleString();
  const timeoutMs = await getHealthCheckTimeoutMs();
  const pools = await getProviderPools();
  const providersByUuid = new Map(
    pools.flatMap((pool) => pool.providers).map((provider) => [provider.uuid, provider] as const)
  );
  const mappings = await getModelMappings();
  let checked = 0;

  const nextMappings = [];
  for (const mapping of mappings) {
    const nextRows = [];
    for (const row of mapping.rows) {
      if (!target.includes(row.health)) {
        nextRows.push(row);
        continue;
      }
      const provider = providersByUuid.get(row.providerUuid);
      if (!provider || !provider.enabled || provider.health !== 'healthy' || !row.upstreamModelName) {
        nextRows.push(row);
        continue;
      }
      const result = await runModelCheck(provider, row.upstreamModelName, checkedAt, timeoutMs);
      checked += 1;
      const nextHealth = row.health === 'healthy' && result.status === 408 ? row.health : result.health;
      nextRows.push({
        ...row,
        health: nextHealth,
        lastHealthStatus: result.status,
        lastHealthResponse: result.responseBody,
        lastHealthCheckedAt: result.checkedAt
      });
    }
    nextMappings.push({
      ...mapping,
      rows: nextRows
    });
  }

  if (checked > 0) {
    await saveModelMappings(nextMappings);
  }
  return { checkedAt, checked };
}
