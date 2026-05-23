import { NextResponse } from 'next/server';
import { validateClientApiKey } from '@/server/auth/client-api-auth';
import { findAnthropicProvider, findOpenAIProvider } from '@/server/config/provider-pools-config';
import { anthropicError } from '@/server/errors/api-errors';
import { logRouteEvent } from '@/server/logging/route-logging';
import { createAnthropicMessage } from '@/server/providers/anthropic-compatible-client';
import { createOpenAIChatCompletion } from '@/server/providers/openai-compatible-client';
import { acquireProviderRateLimit } from '@/server/rate-limits/rate-limit-service';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';
import {
  createAnthropicStreamError,
  openAIStreamToAnthropic,
  relayOpenAIStream,
  sanitizeStreamingForProvider,
  translateAnthropicRequestToOpenAIChat,
  translateOpenAIChatCompletionResponseToAnthropicMessage,
  type AnthropicMessagesRequest
} from '@/server/translation';

export const runtime = 'nodejs';

function parseProviderAlias(segment: string) {
  if (segment.startsWith('claude-')) {
    return { family: 'claude' as const, alias: segment.slice('claude-'.length) };
  }
  if (segment.startsWith('openai-')) {
    return { family: 'openai' as const, alias: segment.slice('openai-'.length) };
  }
  return null;
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('must') || message.includes('not supported') || message.includes('valid JSON')) {
    return 400;
  }
  return 500;
}

export async function handleProviderAliasMessages(request: Request, providerAlias: string) {
  const startedAt = Date.now();
  try {
    ensureRuntimeJobs();
    if (!(await validateClientApiKey(request))) {
      return anthropicError('Missing or invalid API key.', 401, 'authentication_error');
    }

    const parsed = parseProviderAlias(providerAlias);
    if (!parsed) return anthropicError('Invalid provider alias path.', 404, 'not_found_error');

    const body = (await request.json().catch(() => null)) as AnthropicMessagesRequest | null;
    if (!body || typeof body !== 'object') {
      return anthropicError('Request body must be valid JSON.', 400, 'invalid_request_error');
    }
    const wantsStream = body.stream === true;
    if (typeof body.temperature === 'number' && body.temperature > 1) {
      return anthropicError('temperature must be <= 1.', 400, 'invalid_request_error');
    }

    if (parsed.family === 'claude') {
      const provider = await findAnthropicProvider(parsed.alias);
      if (!provider) return anthropicError('Anthropic provider alias was not found.', 404, 'not_found_error');
      if (!provider.enabled) return anthropicError('Selected provider is disabled.', 503, 'api_error');
      const rateLimit = acquireProviderRateLimit(provider);
      if (!rateLimit.allowed) {
        return anthropicError(rateLimit.reason || `Provider is currently rate-limited: ${provider.customName}`, 429, 'rate_limit_error');
      }

      const reqBody = sanitizeStreamingForProvider(body as Record<string, unknown>, provider.supportsStreaming === true);
      if (wantsStream && reqBody.stream === true) {
        const upstream = await createAnthropicMessage(provider, reqBody);
        if (!upstream.response.ok) return createAnthropicStreamError(`Upstream stream failed with status ${upstream.response.status}`);
        return relayOpenAIStream(upstream.response);
      }
      const { response, data } = await createAnthropicMessage(provider, reqBody);
      await logRouteEvent({
        route: `/${providerAlias}/v1/messages`,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        provider: provider.customName,
        model: body.model,
        requestHeaders: Object.fromEntries(request.headers.entries()),
        requestBody: body,
        responseBody: data,
        requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
      });
      return NextResponse.json(data, { status: response.status });
    }

    const provider = await findOpenAIProvider(parsed.alias);
    if (!provider) return anthropicError('OpenAI provider alias was not found.', 404, 'not_found_error');
    if (!provider.enabled) return anthropicError('Selected provider is disabled.', 503, 'api_error');
    const rateLimit = acquireProviderRateLimit(provider);
    if (!rateLimit.allowed) {
      return anthropicError(rateLimit.reason || `Provider is currently rate-limited: ${provider.customName}`, 429, 'rate_limit_error');
    }

    const translatedRequest = sanitizeStreamingForProvider(translateAnthropicRequestToOpenAIChat(body), provider.supportsStreaming === true);
    if (wantsStream && translatedRequest.stream === true) {
      const upstream = await createOpenAIChatCompletion(provider, translatedRequest, { headers: { Accept: 'text/event-stream' } });
      if (!upstream.response.ok) return createAnthropicStreamError(`Upstream stream failed with status ${upstream.response.status}`);
      return openAIStreamToAnthropic(upstream.response, String(translatedRequest.model || body.model));
    }

    const { response, data } = await createOpenAIChatCompletion(provider, translatedRequest);
    if (!response.ok) {
      await logRouteEvent({
        route: `/${providerAlias}/v1/messages`,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        provider: provider.customName,
        model: body.model,
        requestHeaders: Object.fromEntries(request.headers.entries()),
        requestBody: body,
        responseBody: data,
        requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
      });
      return NextResponse.json(data, { status: response.status });
    }
    const translatedResponse = translateOpenAIChatCompletionResponseToAnthropicMessage(
      data,
      typeof translatedRequest.model === 'string' ? translatedRequest.model : ''
    );
    await logRouteEvent({
      route: `/${providerAlias}/v1/messages`,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      provider: provider.customName,
      model: body.model,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      requestBody: body,
      responseBody: translatedResponse,
      requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
    });
    return NextResponse.json(translatedResponse, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = errorStatus(error);
    await logRouteEvent({ route: `/${providerAlias}/v1/messages`, status, latencyMs: Date.now() - startedAt });
    return anthropicError(message, status, 'api_error');
  }
}

export async function POST(request: Request, context: { params: Promise<{ providerAlias: string }> }) {
  const { providerAlias } = await context.params;
  return handleProviderAliasMessages(request, providerAlias);
}
