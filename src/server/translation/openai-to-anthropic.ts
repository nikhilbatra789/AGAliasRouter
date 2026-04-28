import type {
  AnthropicContentBlock,
  AnthropicMessage,
  AnthropicMessagesRequest,
  OpenAIChatCompletionsRequest,
  OpenAIMessage
} from '@/server/translation/types';

function parseImageDataUrl(url: string) {
  const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function normalizeOpenAIContent(content: OpenAIMessage['content']): AnthropicContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  if (!Array.isArray(content)) {
    return [];
  }

  const out: AnthropicContentBlock[] = [];
  for (const part of content) {
    const typed = part as Record<string, unknown>;
    if (typed.type === 'text' && typeof typed.text === 'string') {
      out.push({ type: 'text', text: typed.text });
      continue;
    }
    if (
      typed.type === 'image_url' &&
      typed.image_url &&
      typeof typed.image_url === 'object' &&
      typeof (typed.image_url as { url?: unknown }).url === 'string'
    ) {
      const imageUrl = (typed.image_url as { url: string }).url;
      const parsed = parseImageDataUrl(imageUrl);
      if (parsed) {
        out.push({
          type: 'image',
          source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data }
        });
      } else {
        out.push({
          type: 'image',
          source: { type: 'url', url: imageUrl }
        });
      }
    }
  }
  return out;
}

function normalizeOpenAIMessageContent(message: OpenAIMessage): AnthropicContentBlock[] {
  const contentBlocks = normalizeOpenAIContent(message.content);

  if (message.role === 'assistant') {
    const calls = message.tool_calls || (message.function_call ? [{ id: undefined, type: 'function' as const, function: message.function_call }] : []);
    for (const toolCall of calls) {
      if (!toolCall.function?.name) continue;
      const argText = toolCall.function.arguments || '{}';
      let parsedArgs: Record<string, unknown>;
      try {
        const value = JSON.parse(argText);
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Tool arguments JSON must decode to an object.');
        }
        parsedArgs = value as Record<string, unknown>;
      } catch {
        throw new Error(`Invalid JSON in OpenAI tool call arguments for "${toolCall.function.name}".`);
      }
      contentBlocks.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: parsedArgs
      });
    }
  }

  return contentBlocks;
}

function asText(contentBlocks: AnthropicContentBlock[]) {
  return contentBlocks
    .filter((block) => block && typeof block === 'object' && (block as { type?: unknown }).type === 'text')
    .map((block) => ((block as { text?: unknown }).text as string) || '')
    .filter(Boolean)
    .join('\n');
}

function mergeAnthropicTurns(messages: AnthropicMessage[]) {
  const out: AnthropicMessage[] = [];
  for (const message of messages) {
    const last = out[out.length - 1];
    if (last && last.role === message.role) {
      const lastBlocks = Array.isArray(last.content) ? last.content : [{ type: 'text', text: String(last.content || '') }];
      const nextBlocks = Array.isArray(message.content) ? message.content : [{ type: 'text', text: String(message.content || '') }];
      out[out.length - 1] = { ...last, content: [...lastBlocks, ...nextBlocks] };
      continue;
    }
    out.push(message);
  }
  return out;
}

export function translateOpenAIChatRequestToAnthropic(
  request: OpenAIChatCompletionsRequest
): AnthropicMessagesRequest {
  if (!request || typeof request !== 'object' || !Array.isArray(request.messages)) {
    throw new Error('OpenAI request must include a messages array.');
  }

  if (request.temperature !== undefined && request.temperature > 1) {
    throw new Error('temperature must be <= 1 for Anthropic-backed requests.');
  }

  if (request.n !== undefined && request.n > 1) {
    throw new Error('OpenAI n > 1 is not supported.');
  }

  const systemTextParts: string[] = [];
  const anthropicMessages: AnthropicMessage[] = [];

  for (const message of request.messages) {
    if (!message || typeof message !== 'object' || typeof message.role !== 'string') continue;

    if (message.role === 'system' || message.role === 'developer') {
      const content = normalizeOpenAIMessageContent(message);
      const text = asText(content);
      if (text) {
        systemTextParts.push(`[${message.role}]\n${text}`);
      }
      continue;
    }

    if (message.role === 'function') {
      const content = normalizeOpenAIMessageContent(message);
      anthropicMessages.push({
        role: 'user',
        content: content.length
          ? content
          : [{ type: 'text', text: `Function ${message.name || 'unknown'} returned: ${String(message.content || '')}` }]
      });
      continue;
    }

    if (message.role === 'tool') {
      const text = typeof message.content === 'string' ? message.content : asText(normalizeOpenAIMessageContent(message));
      if (message.tool_call_id) {
        anthropicMessages.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: message.tool_call_id, content: text || '' }]
        });
      } else {
        anthropicMessages.push({
          role: 'user',
          content: [{ type: 'text', text: text || '' }]
        });
      }
      continue;
    }

    if (message.role === 'user' || message.role === 'assistant') {
      anthropicMessages.push({
        role: message.role,
        content: normalizeOpenAIMessageContent(message)
      });
    }
  }

  const maxTokens = Number(request.max_completion_tokens ?? request.max_tokens ?? 1024);
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new Error('max_tokens must be a positive number.');
  }

  const stopSequences = Array.isArray(request.stop)
    ? request.stop.map(String)
    : typeof request.stop === 'string'
      ? [request.stop]
      : undefined;

  const toolChoice =
    request.tool_choice === 'required'
      ? { type: 'any' as const }
      : request.tool_choice === 'none'
        ? { type: 'none' as const }
        : request.tool_choice === 'auto' || request.tool_choice === undefined
          ? { type: 'auto' as const }
          : { type: 'tool' as const, name: request.tool_choice?.function?.name };

  return {
    model: request.model,
    max_tokens: Math.floor(maxTokens),
    messages: mergeAnthropicTurns(anthropicMessages),
    ...(systemTextParts.length ? { system: systemTextParts.join('\n\n') } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(stopSequences ? { stop_sequences: stopSequences } : {}),
    ...(request.stream !== undefined ? { stream: request.stream } : {}),
    ...(Array.isArray(request.tools)
      ? {
          tools: request.tools
            .filter((tool) => tool.type === 'function' && !!tool.function?.name)
            .map((tool) => ({
              name: tool.function!.name!,
              description: tool.function?.description,
              input_schema: tool.function?.parameters || { type: 'object', properties: {} },
              ...(tool.function?.strict !== undefined ? { strict: tool.function.strict } : {})
            }))
        }
      : {}),
    ...(request.tool_choice !== undefined ? { tool_choice: toolChoice } : {}),
    ...(request.response_format !== undefined ? { response_format: request.response_format } : {})
  };
}
