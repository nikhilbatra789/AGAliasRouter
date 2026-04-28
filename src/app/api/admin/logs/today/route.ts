import { NextResponse } from 'next/server';
import { readTodayLogs } from '@/server/logging/log-service';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';
import { uiError } from '@/server/errors/api-errors';

export async function GET() {
  try {
    ensureRuntimeJobs();
    const logs = await readTodayLogs();
    return NextResponse.json({ ok: true, data: logs });
  } catch (error) {
    return uiError(error);
  }
}
