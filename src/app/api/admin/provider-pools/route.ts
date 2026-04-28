import { NextResponse } from 'next/server';
import { getProviderPools, saveProviderPools } from '@/server/config/provider-pools-config';
import { uiError } from '@/server/errors/api-errors';
import { getCachedProviderModels } from '@/server/models/models-cache-service';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const withModels = await hydrateProviderModels(await getProviderPools());
    return NextResponse.json({ ok: true, data: withModels });
  } catch (error) {
    return uiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const pools = await saveProviderPools(body || []);
    return NextResponse.json({ ok: true, data: await hydrateProviderModels(pools) });
  } catch (error) {
    return uiError(error, 400);
  }
}

async function hydrateProviderModels(pools: Awaited<ReturnType<typeof getProviderPools>>) {
  return Promise.all(
    pools.map(async (pool) => ({
      ...pool,
      providers: await Promise.all(
        pool.providers.map(async (provider) => ({
          ...provider,
          models: await getCachedProviderModels(provider.uuid)
        }))
      )
    }))
  );
}
