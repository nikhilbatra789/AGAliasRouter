import { CONFIG_FILES } from './paths';
import { readJsonFile, writeJsonFile } from './json-store';

export type StoredAppConfig = {
  adminUsername: string;
  adminPassword: string;
  sharedApiKey: string;
  sessionLifetimeSeconds: number;
  providerCounter: number;
  cacheIntervalMinutes: number;
  degradedIntervalMinutes: number;
  unhealthyIntervalMinutes: number;
  healthyModelsIntervalMinutes: number;
  unhealthyModelsIntervalMinutes: number;
  retentionIntervalMinutes: number;
  healthCheckTimeoutSeconds: number;
};

export const DEFAULT_APP_CONFIG: StoredAppConfig = {
  adminUsername: 'admin@gmail.com',
  adminPassword: '123456',
  sharedApiKey: 'sk-123456',
  sessionLifetimeSeconds: 60 * 60,
  providerCounter: 0,
  cacheIntervalMinutes: 15,
  degradedIntervalMinutes: 15,
  unhealthyIntervalMinutes: 60,
  healthyModelsIntervalMinutes: 360,
  unhealthyModelsIntervalMinutes: 15,
  retentionIntervalMinutes: 60,
  healthCheckTimeoutSeconds: 60
};

export function maskSecret(value: string) {
  if (!value) return '';
  if (value.length <= 4) return '•'.repeat(value.length);
  return `${value.slice(0, 2)}${'•'.repeat(Math.max(value.length - 6, 4))}${value.slice(-4)}`;
}

function normalizeAppConfig(raw: Partial<StoredAppConfig> | null): StoredAppConfig {
  if (raw && typeof raw !== 'object') {
    throw new Error(`Invalid app config in ${CONFIG_FILES.app}: expected object.`);
  }

  if (raw?.adminUsername !== undefined && (typeof raw.adminUsername !== 'string' || !raw.adminUsername.trim())) {
    throw new Error(`Invalid app config in ${CONFIG_FILES.app}: "adminUsername" must be a non-empty string.`);
  }

  if (raw?.adminPassword !== undefined && (typeof raw.adminPassword !== 'string' || !raw.adminPassword.trim())) {
    throw new Error(`Invalid app config in ${CONFIG_FILES.app}: "adminPassword" must be a non-empty string.`);
  }

  if (raw?.sharedApiKey !== undefined && (typeof raw.sharedApiKey !== 'string' || !raw.sharedApiKey.trim())) {
    throw new Error(`Invalid app config in ${CONFIG_FILES.app}: "sharedApiKey" must be a non-empty string.`);
  }

  if (
    raw?.sessionLifetimeSeconds !== undefined &&
    (!Number.isInteger(raw.sessionLifetimeSeconds) || Number(raw.sessionLifetimeSeconds) <= 0)
  ) {
    throw new Error(`Invalid app config in ${CONFIG_FILES.app}: "sessionLifetimeSeconds" must be a positive integer.`);
  }

  if (
    raw?.providerCounter !== undefined &&
    (!Number.isInteger(raw.providerCounter) || Number(raw.providerCounter) < 0)
  ) {
    throw new Error(`Invalid app config in ${CONFIG_FILES.app}: "providerCounter" must be a non-negative integer.`);
  }

  const intervalFields: Array<keyof Pick<StoredAppConfig, 'cacheIntervalMinutes' | 'degradedIntervalMinutes' | 'unhealthyIntervalMinutes' | 'healthyModelsIntervalMinutes' | 'unhealthyModelsIntervalMinutes' | 'retentionIntervalMinutes' | 'healthCheckTimeoutSeconds'>> = [
    'cacheIntervalMinutes',
    'degradedIntervalMinutes',
    'unhealthyIntervalMinutes',
    'healthyModelsIntervalMinutes',
    'unhealthyModelsIntervalMinutes',
    'retentionIntervalMinutes',
    'healthCheckTimeoutSeconds'
  ];

  for (const field of intervalFields) {
    const value = raw?.[field];
    if (value !== undefined && (!Number.isInteger(value) || Number(value) <= 0)) {
      throw new Error(`Invalid app config in ${CONFIG_FILES.app}: "${field}" must be a positive integer.`);
    }
  }

  return {
    adminUsername: raw?.adminUsername || DEFAULT_APP_CONFIG.adminUsername,
    adminPassword: raw?.adminPassword || DEFAULT_APP_CONFIG.adminPassword,
    sharedApiKey: raw?.sharedApiKey || DEFAULT_APP_CONFIG.sharedApiKey,
    sessionLifetimeSeconds: Number(raw?.sessionLifetimeSeconds || DEFAULT_APP_CONFIG.sessionLifetimeSeconds),
    providerCounter: Number.isInteger(raw?.providerCounter) ? Number(raw?.providerCounter) : DEFAULT_APP_CONFIG.providerCounter,
    cacheIntervalMinutes: Number.isInteger(raw?.cacheIntervalMinutes) ? Number(raw?.cacheIntervalMinutes) : DEFAULT_APP_CONFIG.cacheIntervalMinutes,
    degradedIntervalMinutes: Number.isInteger(raw?.degradedIntervalMinutes) ? Number(raw?.degradedIntervalMinutes) : DEFAULT_APP_CONFIG.degradedIntervalMinutes,
    unhealthyIntervalMinutes: Number.isInteger(raw?.unhealthyIntervalMinutes) ? Number(raw?.unhealthyIntervalMinutes) : DEFAULT_APP_CONFIG.unhealthyIntervalMinutes,
    healthyModelsIntervalMinutes: Number.isInteger(raw?.healthyModelsIntervalMinutes) ? Number(raw?.healthyModelsIntervalMinutes) : DEFAULT_APP_CONFIG.healthyModelsIntervalMinutes,
    unhealthyModelsIntervalMinutes: Number.isInteger(raw?.unhealthyModelsIntervalMinutes) ? Number(raw?.unhealthyModelsIntervalMinutes) : DEFAULT_APP_CONFIG.unhealthyModelsIntervalMinutes,
    retentionIntervalMinutes: Number.isInteger(raw?.retentionIntervalMinutes) ? Number(raw?.retentionIntervalMinutes) : DEFAULT_APP_CONFIG.retentionIntervalMinutes,
    healthCheckTimeoutSeconds: Number.isInteger(raw?.healthCheckTimeoutSeconds) ? Number(raw?.healthCheckTimeoutSeconds) : DEFAULT_APP_CONFIG.healthCheckTimeoutSeconds
  };
}

export async function getAppConfig(): Promise<StoredAppConfig> {
  const raw = await readJsonFile<Partial<StoredAppConfig>>(CONFIG_FILES.app);
  if (!raw) {
    await writeJsonFile(CONFIG_FILES.app, DEFAULT_APP_CONFIG);
    return DEFAULT_APP_CONFIG;
  }
  const normalized = normalizeAppConfig(raw);
  const hasChanges = (Object.keys(DEFAULT_APP_CONFIG) as Array<keyof StoredAppConfig>)
    .some((key) => raw[key] !== normalized[key]);
  if (hasChanges) {
    await writeJsonFile(CONFIG_FILES.app, normalized);
  }
  return normalized;
}

export async function saveAppConfig(next: StoredAppConfig): Promise<StoredAppConfig> {
  if (!next.adminUsername.trim()) throw new Error('Admin username is required.');
  if (!next.adminPassword.trim()) throw new Error('Admin password is required.');
  if (!next.sharedApiKey.trim()) throw new Error('Shared API key is required.');
  const intervals = [
    next.cacheIntervalMinutes,
    next.degradedIntervalMinutes,
    next.unhealthyIntervalMinutes,
    next.healthyModelsIntervalMinutes,
    next.unhealthyModelsIntervalMinutes,
    next.retentionIntervalMinutes,
    next.healthCheckTimeoutSeconds
  ];
  if (intervals.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error('All runtime timer intervals and health timeout values must be positive integers.');
  }
  await writeJsonFile(CONFIG_FILES.app, next);
  return next;
}
