import { NextResponse } from 'next/server';
import { getAppConfig, maskSecret, saveAppConfig } from '@/server/config/app-config';
import { uiError } from '@/server/errors/api-errors';
import { reloadRuntimeJobs } from '@/server/runtime/runtime-jobs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const config = await getAppConfig();
    return NextResponse.json({
      ok: true,
      data: {
        adminUsername: config.adminUsername,
        sharedApiKey: config.sharedApiKey,
        sharedApiKeyMasked: maskSecret(config.sharedApiKey),
        cacheIntervalMinutes: config.cacheIntervalMinutes,
        degradedIntervalMinutes: config.degradedIntervalMinutes,
        unhealthyIntervalMinutes: config.unhealthyIntervalMinutes,
        healthyModelsIntervalMinutes: config.healthyModelsIntervalMinutes,
        unhealthyModelsIntervalMinutes: config.unhealthyModelsIntervalMinutes,
        retentionIntervalMinutes: config.retentionIntervalMinutes
      }
    });
  } catch (error) {
    return uiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string | number>;
    const current = await getAppConfig();

    if (body.adminUsername !== undefined && (typeof body.adminUsername !== 'string' || !body.adminUsername.trim())) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Admin username is required.' } },
        { status: 400 }
      );
    }

    if (body.sharedApiKey !== undefined && (typeof body.sharedApiKey !== 'string' || !body.sharedApiKey.trim())) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Shared API key is required.' } },
        { status: 400 }
      );
    }

    if (body.adminPassword !== undefined && (typeof body.adminPassword !== 'string' || !body.adminPassword.trim())) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Admin password is required.' } },
        { status: 400 }
      );
    }

    const timerFields = [
      'cacheIntervalMinutes',
      'degradedIntervalMinutes',
      'unhealthyIntervalMinutes',
      'healthyModelsIntervalMinutes',
      'unhealthyModelsIntervalMinutes',
      'retentionIntervalMinutes'
    ] as const;

    for (const key of timerFields) {
      if (body[key] === undefined) continue;
      const value = Number(body[key]);
      if (!Number.isInteger(value) || value <= 0) {
        return NextResponse.json(
          { ok: false, error: { code: 'VALIDATION_ERROR', message: `${key} must be a positive integer.` } },
          { status: 400 }
        );
      }
    }

    const saved = await saveAppConfig({
      ...current,
      adminUsername: typeof body.adminUsername === 'string' ? body.adminUsername : current.adminUsername,
      adminPassword: typeof body.adminPassword === 'string' ? body.adminPassword : current.adminPassword,
      sharedApiKey: typeof body.sharedApiKey === 'string' ? body.sharedApiKey : current.sharedApiKey,
      cacheIntervalMinutes: body.cacheIntervalMinutes !== undefined ? Number(body.cacheIntervalMinutes) : current.cacheIntervalMinutes,
      degradedIntervalMinutes: body.degradedIntervalMinutes !== undefined ? Number(body.degradedIntervalMinutes) : current.degradedIntervalMinutes,
      unhealthyIntervalMinutes: body.unhealthyIntervalMinutes !== undefined ? Number(body.unhealthyIntervalMinutes) : current.unhealthyIntervalMinutes,
      healthyModelsIntervalMinutes: body.healthyModelsIntervalMinutes !== undefined ? Number(body.healthyModelsIntervalMinutes) : current.healthyModelsIntervalMinutes,
      unhealthyModelsIntervalMinutes: body.unhealthyModelsIntervalMinutes !== undefined ? Number(body.unhealthyModelsIntervalMinutes) : current.unhealthyModelsIntervalMinutes,
      retentionIntervalMinutes: body.retentionIntervalMinutes !== undefined ? Number(body.retentionIntervalMinutes) : current.retentionIntervalMinutes
    });
    await reloadRuntimeJobs();

    return NextResponse.json({
      ok: true,
      data: {
        adminUsername: saved.adminUsername,
        sharedApiKey: saved.sharedApiKey,
        sharedApiKeyMasked: maskSecret(saved.sharedApiKey),
        cacheIntervalMinutes: saved.cacheIntervalMinutes,
        degradedIntervalMinutes: saved.degradedIntervalMinutes,
        unhealthyIntervalMinutes: saved.unhealthyIntervalMinutes,
        healthyModelsIntervalMinutes: saved.healthyModelsIntervalMinutes,
        unhealthyModelsIntervalMinutes: saved.unhealthyModelsIntervalMinutes,
        retentionIntervalMinutes: saved.retentionIntervalMinutes
      }
    });
  } catch (error) {
    return uiError(error);
  }
}
