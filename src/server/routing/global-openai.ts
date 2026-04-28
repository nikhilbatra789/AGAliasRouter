import { NextResponse } from 'next/server';
import { validateClientApiKey } from '@/server/auth/client-api-auth';
import { openAIError } from '@/server/errors/api-errors';
import { getGlobalOpenAIModels } from '@/server/models/models-cache-service';
import { markRouteSelectionResult, resolveMappedModel } from '@/server/routing/model-router';
import { createOpenAIChatCompletion } from '@/server/providers/openai-compatible-client';
import { createAnthropicMessage } from '@/server/providers/anthropic-compatible-client';
import { logRouteEvent } from '@/server/logging/route-logging';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';
import {
  translateAnthropicResponseToOpenAIChatCompletion,
  translateOpenAIChatRequestToAnthropic,
  type OpenAIChatCompletionsRequest
} from '@/server/translation';

async function requireAuth(request: Request) {
  if (!(await validateClientApiKey(request))) {
    return openAIError('Missing or invalid API key.', 401, 'authentication_error');
  }
  return null;
}

export async function handleGlobalOpenAIModels(request: Request) {
  const startedAt = Date.now();
  try {
    ensureRuntimeJobs();
    const authError = await requireAuth(request);
    if (authError) return authError;
    const payload = await getGlobalOpenAIModels();
    const response = NextResponse.json(payload);
    await logRouteEvent({
      route: '/v1/models',
      status: response.status,
      latencyMs: Date.now() - startedAt,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      responseBody: payload,
      requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logRouteEvent({ route: '/v1/models', status: 500, latencyMs: Date.now() - startedAt });
    return openAIError(message, 500, 'server_error');
  }
}

export async function handleGlobalOpenAIChatCompletions(request: Request) {
  const startedAt = Date.now();
  try {
    ensureRuntimeJobs();
    const authError = await requireAuth(request);
    if (authError) return authError;

    const body = (await request.json().catch(() => null)) as (OpenAIChatCompletionsRequest & { stream?: unknown }) | null;
    if (!body || typeof body !== 'object') return openAIError('Request body must be valid JSON.', 400);
    if (body.stream === true) return openAIError('Streaming is not supported in v1.', 400, 'unsupported_feature');
    if (typeof body.temperature === 'number' && body.temperature > 1) {
      return openAIError('temperature must be <= 1.', 400, 'invalid_request_error');
    }
    if (typeof body.n === 'number' && body.n > 1) {
      return openAIError('OpenAI n > 1 is not supported.', 400, 'invalid_request_error');
    }
    if (!body.model) return openAIError('Request body must include a model.', 400);

    const selection = await resolveMappedModel(body.model);
    if (!selection) return openAIError(`Model alias was not found or has no available provider: ${body.model}`, 404, 'model_not_found');

    if (selection.provider.family === 'anthropic-custom') {
      const anthropicBody = translateOpenAIChatRequestToAnthropic({ ...body, model: selection.upstreamModelName });
      const { response, data } = await createAnthropicMessage(selection.provider, anthropicBody);
      if (!response.ok) {
        await logRouteEvent({
          route: '/v1/chat/completions',
          status: response.status,
          latencyMs: Date.now() - startedAt,
          provider: selection.provider.customName,
          model: selection.upstreamModelName,
          requestHeaders: Object.fromEntries(request.headers.entries()),
          requestBody: body,
          responseBody: data,
          requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
        });
        return NextResponse.json(data, { status: response.status });
      }
      const translatedData = translateAnthropicResponseToOpenAIChatCompletion(data, selection.upstreamModelName);
      const translated = NextResponse.json(translatedData, { status: response.status });
      await markRouteSelectionResult(selection, response.status);
      await logRouteEvent({
        route: '/v1/chat/completions',
        status: response.status,
        latencyMs: Date.now() - startedAt,
        provider: selection.provider.customName,
        model: selection.upstreamModelName,
        requestHeaders: Object.fromEntries(request.headers.entries()),
        requestBody: body,
        responseBody: translatedData,
        requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
      });
      return translated;
    }

    const { response, data } = await createOpenAIChatCompletion(selection.provider, { ...body, model: selection.upstreamModelName });
    await markRouteSelectionResult(selection, response.status);
    await logRouteEvent({
      route: '/v1/chat/completions',
      status: response.status,
      latencyMs: Date.now() - startedAt,
      provider: selection.provider.customName,
      model: selection.upstreamModelName,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      requestBody: body,
      responseBody: data,
      requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('must') || message.includes('not supported') || message.includes('Invalid JSON') ? 400 : 500;
    await logRouteEvent({ route: '/v1/chat/completions', status, latencyMs: Date.now() - startedAt });
    return openAIError(message, status, status === 400 ? 'invalid_request_error' : 'server_error');
  }
}
