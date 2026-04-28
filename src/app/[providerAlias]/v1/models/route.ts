import { handleOpenAIProviderModels } from '@/server/routing/openai-passthrough';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ providerAlias: string }> }) {
  const params = await context.params;
  return handleOpenAIProviderModels(request, params.providerAlias);
}
