import { handleProviderAliasMessages } from '@/app/[providerAlias]/v1/messages/route';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ providerAlias: string }> }) {
  const { providerAlias } = await context.params;
  return handleProviderAliasMessages(request, providerAlias);
}
