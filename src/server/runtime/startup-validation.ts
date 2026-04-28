import { getAppConfig } from '@/server/config/app-config';
import { getModelMappings } from '@/server/config/model-mappings-config';
import { getProviderPools } from '@/server/config/provider-pools-config';

declare global {
  var __aglias_startup_validated__: boolean | undefined;
}

export async function validateStartupConfigOnce() {
  if (globalThis.__aglias_startup_validated__) return;
  await getAppConfig();
  await getProviderPools();
  await getModelMappings();
  globalThis.__aglias_startup_validated__ = true;
}

