import path from 'node:path';

export const CONFIG_DIR = path.join(process.cwd(), 'config');
export const LOGS_DIR = path.join(process.cwd(), 'logs');

export const CONFIG_FILES = {
  app: path.join(CONFIG_DIR, 'app_config.json'),
  providerPools: path.join(CONFIG_DIR, 'provider_pools.json'),
  modelMappings: path.join(CONFIG_DIR, 'model_mappings.json'),
  modelsCache: path.join(CONFIG_DIR, 'models_cache.json')
} as const;
