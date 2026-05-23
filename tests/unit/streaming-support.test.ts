import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sanitizeStreamingForProvider,
  anthropicStreamToOpenAI,
  openAIStreamToAnthropic
} from '../../src/server/translation/streaming.ts';

test('sanitizeStreamingForProvider removes stream flags when provider does not support streaming', () => {
  const downgraded = sanitizeStreamingForProvider({ model: 'x', stream: true, stream_options: { include_usage: true } }, false);
  assert.equal('stream' in downgraded, false);
  assert.equal('stream_options' in downgraded, false);
});

test('anthropicStreamToOpenAI emits DONE and optional usage chunk', async () => {
  const payload = [
    'event: content_block_delta\n',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
    'event: message_delta\n',
    'data: {"type":"message_delta","usage":{"input_tokens":2,"output_tokens":3}}\n\n'
  ].join('');
  const response = new Response(payload, { headers: { 'content-type': 'text/event-stream' } });
  const out = anthropicStreamToOpenAI(response, 'claude-test', true);
  const text = await out.text();
  assert.match(text, /chat\.completion\.chunk/);
  assert.match(text, /"usage"/);
  assert.match(text, /\[DONE\]/);
});

test('openAIStreamToAnthropic emits anthropic event envelope', async () => {
  const payload = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n';
  const response = new Response(payload, { headers: { 'content-type': 'text/event-stream' } });
  const out = openAIStreamToAnthropic(response, 'gpt-test');
  const text = await out.text();
  assert.match(text, /event: message_start/);
  assert.match(text, /event: content_block_delta/);
  assert.match(text, /event: message_stop/);
});
