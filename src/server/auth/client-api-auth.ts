import { getAppConfig } from '@/server/config/app-config';

export async function validateClientApiKey(request: Request) {
  const config = await getAppConfig();
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  const xApiKey = request.headers.get('x-api-key') || '';
  return bearer === config.sharedApiKey || xApiKey === config.sharedApiKey;
}
