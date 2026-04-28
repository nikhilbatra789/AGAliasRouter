import { cookies } from 'next/headers';
import { getAppConfig } from '@/server/config/app-config';

export async function validateAdminCredentials(username: string, password: string) {
  const config = await getAppConfig();
  return username === config.adminUsername && password === config.adminPassword;
}

export async function setAdminSessionCookie() {
  const config = await getAppConfig();
  const cookieStore = await cookies();
  cookieStore.set('aglias_session', 'active', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionLifetimeSeconds
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('aglias_session');
}
