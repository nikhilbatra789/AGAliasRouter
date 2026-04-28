import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearAdminSessionCookie, setAdminSessionCookie, validateAdminCredentials } from '@/server/auth/admin-session';
import { getAppConfig } from '@/server/config/app-config';
import { uiError } from '@/server/errors/api-errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get('aglias_session')?.value !== 'active') {
      return NextResponse.json(
        { ok: false, error: { code: 'SESSION_MISSING', message: 'No active session.' } },
        { status: 401 }
      );
    }

    const config = await getAppConfig();
    return NextResponse.json({
      ok: true,
      data: {
        username: config.adminUsername,
        expiresAt: new Date(Date.now() + config.sessionLifetimeSeconds * 1000).toISOString()
      }
    });
  } catch (error) {
    return uiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };

    if (!(await validateAdminCredentials(body.username || '', body.password || ''))) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_LOGIN', message: 'Invalid username or password.' } },
        { status: 401 }
      );
    }

    await setAdminSessionCookie();
    const config = await getAppConfig();
    return NextResponse.json({
      ok: true,
      data: {
        username: config.adminUsername,
        expiresAt: new Date(Date.now() + config.sessionLifetimeSeconds * 1000).toISOString()
      }
    });
  } catch (error) {
    return uiError(error);
  }
}

export async function DELETE() {
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true, data: { ok: true } });
}
