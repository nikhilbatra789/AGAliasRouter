import { NextResponse } from 'next/server';
import { checkProviderModel, checkProviders } from '@/server/health/health-check-service';
import { uiError } from '@/server/errors/api-errors';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';

export async function POST(request: Request) {
  try {
    ensureRuntimeJobs();
    const body = (await request.json().catch(() => ({}))) as { scope?: string; modelName?: string };
    if (body.scope && body.modelName) {
      return NextResponse.json({
        ok: true,
        data: await checkProviderModel(body.scope, body.modelName)
      });
    }
    return NextResponse.json({
      ok: true,
      data: await checkProviders(body.scope || 'all')
    });
  } catch (error) {
    return uiError(error);
  }
}
