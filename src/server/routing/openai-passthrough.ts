import { NextResponse } from 'next/server';
import { validateClientApiKey } from '@/server/auth/client-api-auth';
import { findAnthropicProvider, findOpenAIProvider } from '@/server/config/provider-pools-config';
import { openAIError } from '@/server/errors/api-errors';
import { logRouteEvent } from '@/server/logging/route-logging';
import { updateProviderModelsCache } from '@/server/models/models-cache-service';
import { createAnthropicMessage, fetchAnthropicModels } from '@/server/providers/anthropic-compatible-client';
import { createOpenAIChatCompletion, fetchOpenAIModels } from '@/server/providers/openai-compatible-client';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';
import {
  translateAnthropicResponseToOpenAIChatCompletion,
  translateOpenAIChatRequestToAnthropic,
  type OpenAIChatCompletionsRequest
} from '@/server/translation';

function parseProviderAlias(segment: string) {
  if (segment.startsWith('openai-')) {
    return { family: 'openai' as const, alias: segment.slice('openai-'.length) };
  }
  if (segment.startsWith('claude-')) {
    return { family: 'claude' as const, alias: segment.slice('claude-'.length) };
  }
  return null;
}

async function requireAuth(request: Request) {
  if (!(await validateClientApiKey(request))) {
    return openAIError('Missing or invalid API key.', 401, 'authentication_error');
  }
  return null;
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes('must be') ||
    message.includes('not supported') ||
    message.includes('Request body') ||
    message.includes('Invalid JSON in OpenAI tool call arguments')
  ) {
    return 400;
  }
  return 500;
}

export async function handleOpenAIProviderModels(request: Request, providerAliasSegment: string) {
  const startedAt = Date.now();
  try {
    ensureRuntimeJobs();
    const authError = await requireAuth(request);
    if (authError) return authError;

    const parsed = parseProviderAlias(providerAliasSegment);
    if (!parsed) return openAIError('Invalid provider alias path.', 404, 'invalid_route');

    const provider =
      parsed.family === 'openai' ? await findOpenAIProvider(parsed.alias) : await findAnthropicProvider(parsed.alias);
    if (!provider) return openAIError('Provider alias was not found.', 404, 'provider_not_found');
    if (!provider.enabled) return openAIError('Selected provider is disabled.', 503, 'provider_unavailable');

    const { response, data } =
      parsed.family === 'openai' ? await fetchOpenAIModels(provider) : await fetchAnthropicModels(provider);
    if (response.ok) {
      await updateProviderModelsCache(provider, data);
    }
    await logRouteEvent({
      route: `/${providerAliasSegment}/v1/models`,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      provider: provider.customName,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      responseBody: data,
      requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logRouteEvent({ route: `/${providerAliasSegment}/v1/models`, status: 500, latencyMs: Date.now() - startedAt });
    return openAIError(message, 500, 'server_error');
  }
}

export async function handleOpenAIProviderChatCompletions(request: Request, providerAliasSegment: string) {
  const startedAt = Date.now();
  try {
    ensureRuntimeJobs();
    const authError = await requireAuth(request);
    if (authError) return authError;

    const parsed = parseProviderAlias(providerAliasSegment);
    if (!parsed) return openAIError('Invalid provider alias path.', 404, 'invalid_route');

    const provider =
      parsed.family === 'openai' ? await findOpenAIProvider(parsed.alias) : await findAnthropicProvider(parsed.alias);
    if (!provider) return openAIError('Provider alias was not found.', 404, 'provider_not_found');
    if (!provider.enabled) return openAIError('Selected provider is disabled.', 503, 'provider_unavailable');

    const body = (await request.json().catch(() => null)) as
      | ({ stream?: unknown; temperature?: unknown; n?: unknown } & Record<string, unknown>)
      | null;
    if (!body || typeof body !== 'object') return openAIError('Request body must be valid JSON.', 400);
    if (body.stream === true) return openAIError('Streaming is not supported in v1.', 400, 'unsupported_feature');
    if (typeof body.temperature === 'number' && body.temperature > 1) {
      return openAIError('temperature must be <= 1.', 400, 'invalid_request_error');
    }
    if (typeof body.n === 'number' && body.n > 1) {
      return openAIError('OpenAI n > 1 is not supported.', 400, 'invalid_request_error');
    }

    if (parsed.family === 'openai') {
      const { response, data } = await createOpenAIChatCompletion(provider, body);
      await logRouteEvent({
        route: `/${providerAliasSegment}/v1/chat/completions`,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        provider: provider.customName,
        requestHeaders: Object.fromEntries(request.headers.entries()),
        requestBody: body,
        responseBody: data,
        requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
      });
      return NextResponse.json(data, { status: response.status });
    }

    const anthropicBody = translateOpenAIChatRequestToAnthropic(body as OpenAIChatCompletionsRequest);
    if (anthropicBody.stream === true) {
      return openAIError('Streaming is not supported in v1.', 400, 'unsupported_feature');
    }

    const { response, data } = await createAnthropicMessage(provider, anthropicBody);
    if (!response.ok) {
      await logRouteEvent({
        route: `/${providerAliasSegment}/v1/chat/completions`,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        provider: provider.customName,
        requestHeaders: Object.fromEntries(request.headers.entries()),
        requestBody: body,
        responseBody: data,
        requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
      });
      return NextResponse.json(data, { status: response.status });
    }
    const translated = translateAnthropicResponseToOpenAIChatCompletion(
      data,
      typeof anthropicBody.model === 'string' ? anthropicBody.model : ''
    );
    await logRouteEvent({
      route: `/${providerAliasSegment}/v1/chat/completions`,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      provider: provider.customName,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      requestBody: body,
      responseBody: translated,
      requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
    });
    return NextResponse.json(translated, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logRouteEvent({
      route: `/${providerAliasSegment}/v1/chat/completions`,
      status: errorStatus(error),
      latencyMs: Date.now() - startedAt
    });
    return openAIError(message, errorStatus(error), 'server_error');
  }
}
