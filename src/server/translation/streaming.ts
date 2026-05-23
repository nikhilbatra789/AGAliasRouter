import { randomUUID } from 'node:crypto';

function toSseLine(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function createOpenAIStreamError(reason: string) {
  return new Response(toSseLine({ error: { message: reason, type: 'api_error', code: 'stream_error' } }), {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}

export function createAnthropicStreamError(reason: string) {
  return new Response(`event: error\ndata: ${JSON.stringify({ type: 'error', error: { type: 'api_error', message: reason } })}\n\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}

function openAiDelta(content: string, model: string, id: string) {
  return {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content }, finish_reason: null }]
  };
}

function openAiStop(model: string, id: string) {
  return {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
  };
}

export function sanitizeStreamingForProvider<T extends Record<string, unknown>>(body: T, supportsStreaming: boolean) {
  if (supportsStreaming) return body;
  const out = { ...body };
  delete out.stream;
  delete out.stream_options;
  return out;
}

export function relayOpenAIStream(response: Response) {
  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}

export function anthropicStreamToOpenAI(response: Response, model: string, includeUsage: boolean) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const id = `chatcmpl_${randomUUID()}`;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!response.body) {
        controller.enqueue(encoder.encode(toSseLine(openAiStop(model, id)) + 'data: [DONE]\n\n'));
        controller.close();
        return;
      }
      const reader = response.body.getReader();
      let buffer = '';
      let usage: { input_tokens?: number; output_tokens?: number } = {};
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const dataLine = event.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          const payload = dataLine.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          let parsed: Record<string, unknown>;
          try { parsed = JSON.parse(payload); } catch { continue; }
          if (parsed.type === 'content_block_delta') {
            const delta = parsed.delta as Record<string, unknown>;
            if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
              controller.enqueue(encoder.encode(toSseLine(openAiDelta(delta.text, model, id))));
            }
          }
          if (parsed.type === 'message_delta' && parsed.usage && typeof parsed.usage === 'object') {
            usage = parsed.usage as { input_tokens?: number; output_tokens?: number };
          }
        }
      }
      controller.enqueue(encoder.encode(toSseLine(openAiStop(model, id))));
      if (includeUsage) {
        const completion = Number(usage.output_tokens || 0);
        const prompt = Number(usage.input_tokens || 0);
        controller.enqueue(encoder.encode(toSseLine({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [], usage: { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion } })));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}

export function openAIStreamToAnthropic(response: Response, model: string) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: `msg_${randomUUID()}`, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } })}\n\n`));
      if (!response.body) {
        controller.enqueue(encoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'));
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode('event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n'));
      const reader = response.body.getReader();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const dataLine = event.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          const payload = dataLine.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          let parsed: Record<string, unknown>;
          try { parsed = JSON.parse(payload); } catch { continue; }
          const delta = Array.isArray(parsed.choices) ? (parsed.choices[0] as Record<string, unknown>)?.delta as Record<string, unknown> : null;
          if (delta && typeof delta.content === 'string' && delta.content) {
            controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: delta.content } })}\n\n`));
          }
        }
      }
      controller.enqueue(encoder.encode('event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n'));
      controller.enqueue(encoder.encode('event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":0}}\n\n'));
      controller.enqueue(encoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'));
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
