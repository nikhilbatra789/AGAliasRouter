import { handleOpenAIProviderChatCompletions } from '@/server/routing/openai-passthrough';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ providerAlias: string }> }) {
  const params = await context.params;
  return handleOpenAIProviderChatCompletions(request, params.providerAlias);
}
