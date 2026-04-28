import { NextResponse } from 'next/server';
import { deleteCredentialFile, listCredentialFiles } from '@/server/credentials/credential-files-service';
import { uiError } from '@/server/errors/api-errors';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await listCredentialFiles() });
  } catch (error) {
    return uiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    return NextResponse.json({
      ok: true,
      data: await deleteCredentialFile(body.name || '')
    });
  } catch (error) {
    return uiError(error);
  }
}
