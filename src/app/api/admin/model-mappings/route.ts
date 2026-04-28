import { NextResponse } from 'next/server';
import { getModelMappings, saveModelMappings } from '@/server/config/model-mappings-config';
import { uiError } from '@/server/errors/api-errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await getModelMappings() });
  } catch (error) {
    return uiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    return NextResponse.json({ ok: true, data: await saveModelMappings(body || []) });
  } catch (error) {
    return uiError(error, 400);
  }
}
