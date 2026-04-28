import { randomUUID } from 'node:crypto';
import type {
  AnthropicContentBlock,
  AnthropicMessage,
  AnthropicMessagesRequest,
  OpenAIChatCompletionsRequest
} from '@/server/translation/types';

function anthropicContentToOpenAI(content: AnthropicMessage['content']) {
  const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
  if (!Array.isArray(blocks)) return '';

  const textParts: string[] = [];
  const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const type = (block as { type?: unknown }).type;
    if (type === 'text' && typeof (block as { text?: unknown }).text === 'string') {
      textParts.push((block as { text: string }).text);
      continue;
    }
    if (type === 'tool_use') {
      const toolUse = block as { id?: string; name?: string; input?: unknown };
      toolCalls.push({
        id: toolUse.id || `call_${randomUUID()}`,
        type: 'function',
        function: {
          name: toolUse.name || 'tool',
          arguments: JSON.stringify(toolUse.input && typeof toolUse.input === 'object' ? toolUse.input : {})
        }
      });
    }
  }

  return {
    content: textParts.join(''),
    tool_calls: toolCalls.length ? toolCalls : undefined
  };
}

function openAIMessageToAnthropicContent(message: {
  content?: string | null;
  tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
}): AnthropicContentBlock[] {
  const blocks: AnthropicContentBlock[] = [];
  if (typeof message.content === 'string' && message.content) {
    blocks.push({ type: 'text', text: message.content });
  }
  for (const toolCall of message.tool_calls || []) {
    let parsed: Record<string, unknown> = {};
    try {
      const maybe = JSON.parse(toolCall.function?.arguments || '{}');
      if (maybe && typeof maybe === 'object' && !Array.isArray(maybe)) {
        parsed = maybe as Record<string, unknown>;
      }
    } catch {
      parsed = { _raw: toolCall.function?.arguments || '' };
    }
    blocks.push({
      type: 'tool_use',
      id: toolCall.id || `tool_${randomUUID()}`,
      name: toolCall.function?.name || 'tool',
      input: parsed
    });
  }
  return blocks;
}

export function translateAnthropicRequestToOpenAIChat(
  request: AnthropicMessagesRequest
): OpenAIChatCompletionsRequest {
  if (!request || typeof request !== 'object' || !Array.isArray(request.messages)) {
    throw new Error('Anthropic request must include a messages array.');
  }
  if (request.temperature !== undefined && request.temperature > 1) {
    throw new Error('temperature must be <= 1 for OpenAI translation mode.');
  }

  const openAIMessages: OpenAIChatCompletionsRequest['messages'] = [];

  if (request.system) {
    const systemText =
      typeof request.system === 'string'
        ? request.system
        : Array.isArray(request.system)
          ? request.system
              .filter((block) => block && typeof block === 'object' && (block as { type?: unknown }).type === 'text')
              .map((block) => String((block as { text?: unknown }).text || ''))
              .join('\n')
          : '';
    if (systemText) {
      openAIMessages.push({ role: 'system', content: systemText });
    }
  }

  for (const message of request.messages) {
    if (!message || typeof message !== 'object') continue;
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const normalized = anthropicContentToOpenAI(message.content);
    if (typeof normalized === 'string') {
      openAIMessages.push({ role, content: normalized });
    } else {
      openAIMessages.push({
        role,
        content: normalized.content || '',
        ...(normalized.tool_calls ? { tool_calls: normalized.tool_calls } : {})
      });
    }
  }

  return {
    model: request.model,
    messages: openAIMessages,
    max_completion_tokens: request.max_tokens,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(request.stream !== undefined ? { stream: request.stream } : {}),
    ...(Array.isArray(request.stop_sequences) ? { stop: request.stop_sequences } : {}),
    ...(Array.isArray(request.tools)
      ? {
          tools: request.tools.map((tool) => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.input_schema || { type: 'object', properties: {} }
            }
          }))
        }
      : {}),
    ...(request.tool_choice
      ? {
          tool_choice:
            request.tool_choice.type === 'none'
              ? 'none'
              : request.tool_choice.type === 'any'
                ? 'required'
                : request.tool_choice.type === 'tool'
                  ? { type: 'function', function: { name: request.tool_choice.name || '' } }
                  : 'auto'
        }
      : {}),
    ...(request.response_format !== undefined ? { response_format: request.response_format } : {})
  };
}

export function translateAnthropicResponseToOpenAIChatCompletion(response: unknown, requestedModel: string) {
  const body = response && typeof response === 'object' ? (response as Record<string, unknown>) : {};
  const content = Array.isArray(body.content) ? (body.content as AnthropicContentBlock[]) : [];
  const converted = anthropicContentToOpenAI(content);
  const message =
    typeof converted === 'string'
      ? { role: 'assistant' as const, content: converted }
      : {
          role: 'assistant' as const,
          content: converted.content || '',
          ...(converted.tool_calls ? { tool_calls: converted.tool_calls } : {})
        };

  const stopReason = typeof body.stop_reason === 'string' ? body.stop_reason : 'stop_sequence';
  const finishReason =
    stopReason === 'tool_use' ? 'tool_calls' : stopReason === 'max_tokens' ? 'length' : 'stop';
  const usage = body.usage && typeof body.usage === 'object' ? (body.usage as Record<string, unknown>) : {};

  return {
    id: typeof body.id === 'string' ? body.id : `chatcmpl_${randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: typeof body.model === 'string' ? body.model : requestedModel,
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason
      }
    ],
    usage: {
      prompt_tokens: Number(usage.input_tokens || 0),
      completion_tokens: Number(usage.output_tokens || 0),
      total_tokens: Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0)
    }
  };
}

export function translateOpenAIChatCompletionResponseToAnthropicMessage(
  response: unknown,
  requestedModel: string
) {
  const body = response && typeof response === 'object' ? (response as Record<string, unknown>) : {};
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const first = (choices[0] && typeof choices[0] === 'object' ? choices[0] : {}) as Record<string, unknown>;
  const message = (first.message && typeof first.message === 'object' ? first.message : {}) as {
    role?: string;
    content?: string | null;
    tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
  };

  const contentBlocks = openAIMessageToAnthropicContent(message);
  const finish = typeof first.finish_reason === 'string' ? first.finish_reason : 'stop';
  const stopReason = finish === 'tool_calls' ? 'tool_use' : finish === 'length' ? 'max_tokens' : 'end_turn';
  const usage = body.usage && typeof body.usage === 'object' ? (body.usage as Record<string, unknown>) : {};

  return {
    id: typeof body.id === 'string' ? body.id : `msg_${randomUUID()}`,
    type: 'message',
    role: 'assistant',
    model: typeof body.model === 'string' ? body.model : requestedModel,
    content: contentBlocks,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: Number(usage.prompt_tokens || 0),
      output_tokens: Number(usage.completion_tokens || 0)
    }
  };
}
