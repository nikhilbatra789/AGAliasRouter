import { handleGlobalOpenAIChatCompletions } from '@/server/routing/global-openai';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleGlobalOpenAIChatCompletions(request);
}
