import { NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/server/dashboard/dashboard-service';
import { uiError } from '@/server/errors/api-errors';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';

export async function GET() {
  try {
    ensureRuntimeJobs();
    return NextResponse.json({ ok: true, data: await getDashboardMetrics() });
  } catch (error) {
    return uiError(error);
  }
}
