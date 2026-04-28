import { handleGlobalOpenAIModels } from '@/server/routing/global-openai';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleGlobalOpenAIModels(request);
}
