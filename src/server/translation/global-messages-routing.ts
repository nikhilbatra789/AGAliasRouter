import { createAnthropicMessage } from '@/server/providers/anthropic-compatible-client';
import { createOpenAIChatCompletion } from '@/server/providers/openai-compatible-client';
import { markRouteSelectionResult, resolveMappedModel } from '@/server/routing/model-router';
import {
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

  if (selection.provider.family === 'anthropic-custom') {
    const { response, data } = await createAnthropicMessage(selection.provider, {
      ...request,
      model: selection.upstreamModelName
    });
    await markRouteSelectionResult(selection, response.status);
    return { data, status: response.status };
  }

  const translatedRequest = translateAnthropicRequestToOpenAIChat({
    ...request,
    model: selection.upstreamModelName
  });
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
