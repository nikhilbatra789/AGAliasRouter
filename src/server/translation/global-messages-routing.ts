import { createAnthropicMessage } from '@/server/providers/anthropic-compatible-client';
import { createOpenAIChatCompletion } from '@/server/providers/openai-compatible-client';
import { markRouteSelectionResult, resolveMappedModel } from '@/server/routing/model-router';
import {
  createAnthropicStreamError,
  openAIStreamToAnthropic,
  sanitizeStreamingForProvider,
  translateAnthropicRequestToOpenAIChat,
  translateOpenAIChatCompletionResponseToAnthropicMessage,
  type AnthropicMessagesRequest
} from '@/server/translation';

export async function routeGlobalAnthropicMessagesRequest(request: AnthropicMessagesRequest) {
  if (!request.model) {
    throw new Error('Request body must include a model.');
  }

  const selection = await resolveMappedModel(request.model);
  if (!selection) {
    throw new Error(`Model alias was not found or has no available provider: ${request.model}`);
  }

  const wantsStream = request.stream === true;
  if (selection.provider.family === 'anthropic-custom') {
    const directBody = sanitizeStreamingForProvider({ ...request, model: selection.upstreamModelName }, selection.provider.supportsStreaming === true);
    const { response, data } = await createAnthropicMessage(selection.provider, {
      ...directBody
    });
    await markRouteSelectionResult(selection, response.status);
    return { data, status: response.status };
  }

  const translatedRequest = sanitizeStreamingForProvider(translateAnthropicRequestToOpenAIChat({
    ...request,
    model: selection.upstreamModelName
  }), selection.provider.supportsStreaming === true);
  if (wantsStream && translatedRequest.stream === true) {
    const upstream = await createOpenAIChatCompletion(selection.provider, translatedRequest, { headers: { Accept: 'text/event-stream' } });
    await markRouteSelectionResult(selection, upstream.response.status);
    if (!upstream.response.ok) return { data: createAnthropicStreamError(`Upstream stream failed with status ${upstream.response.status}`), status: 200 };
    return { data: openAIStreamToAnthropic(upstream.response, selection.upstreamModelName), status: 200 };
  }
  const { response, data } = await createOpenAIChatCompletion(selection.provider, translatedRequest);
  await markRouteSelectionResult(selection, response.status);
  if (!response.ok) {
    return { data, status: response.status };
  }
  return {
    data: translateOpenAIChatCompletionResponseToAnthropicMessage(data, selection.upstreamModelName),
    status: response.status
  };
}
