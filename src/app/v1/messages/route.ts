import { NextResponse } from 'next/server';
import { validateClientApiKey } from '@/server/auth/client-api-auth';
import { anthropicError } from '@/server/errors/api-errors';
import { logRouteEvent } from '@/server/logging/route-logging';
import { RouteRateLimitError } from '@/server/routing/model-router';
import { ensureRuntimeJobs } from '@/server/runtime/runtime-jobs';
import { routeGlobalAnthropicMessagesRequest } from '@/server/translation/global-messages-routing';
import type { AnthropicMessagesRequest } from '@/server/translation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    ensureRuntimeJobs();
    if (!(await validateClientApiKey(request))) {
      return anthropicError('Missing or invalid API key.', 401, 'authentication_error');
    }

    const body = (await request.json().catch(() => null)) as AnthropicMessagesRequest | null;
    if (!body || typeof body !== 'object') {
      return anthropicError('Request body must be valid JSON.', 400, 'invalid_request_error');
    }
    if (body.stream === true) {
      return anthropicError('Streaming is not supported in v1.', 400, 'invalid_request_error');
    }

    const { data, status } = await routeGlobalAnthropicMessagesRequest(body);
    await logRouteEvent({
      route: '/v1/messages',
      status,
      latencyMs: Date.now() - startedAt,
      model: body.model,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      requestBody: body,
      responseBody: data,
      requestBodyLoggingEnabled: request.headers.get('x-aglias-log-body') === '1'
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof RouteRateLimitError) {
      await logRouteEvent({ route: '/v1/messages', status: 429, latencyMs: Date.now() - startedAt });
      return anthropicError(message, 429, 'rate_limit_error');
    }
    const status = message.includes('must') || message.includes('not found') ? 400 : 500;
    await logRouteEvent({ route: '/v1/messages', status, latencyMs: Date.now() - startedAt });
    return anthropicError(message, status, status === 400 ? 'invalid_request_error' : 'api_error');
  }
}
