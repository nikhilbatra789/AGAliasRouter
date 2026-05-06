import { NextResponse } from 'next/server';
import { buildConfigFolderZip, deleteCredentialFile, listCredentialFiles } from '@/server/credentials/credential-files-service';
import { uiError } from '@/server/errors/api-errors';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    if (searchParams.get('download') === 'zip') {
      const zip = await buildConfigFolderZip();
      return new Response(zip, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="config.zip"',
          'Content-Length': String(zip.length)
        }
      });
    }
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
