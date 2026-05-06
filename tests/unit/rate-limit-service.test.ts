import assert from 'node:assert/strict';
import test from 'node:test';
import { acquireProviderRateLimit, resetProviderRateLimits } from '../../src/server/rate-limits/rate-limit-service.ts';

test('next year provider allows only five requests per minute across different models', async () => {
  resetProviderRateLimits();

  const provider = {
    uuid: 'provider-next-year',
    customName: 'next year',
    rateLimits: {
      requestsPerMinute: 5
    }
  };
  const modelNames = [
    'gpt-model',
    'glm-model',
    'glm-4.71',
    'claude-model',
    'another-model',
    'sixth-model'
  ];

  const results = await Promise.all(
    modelNames.map(async () => acquireProviderRateLimit(provider))
  );

  assert.equal(results.filter((result) => result.allowed).length, 5);
  assert.equal(results.filter((result) => !result.allowed).length, 1);
  assert.equal(results[5].allowed, false);
  assert.match(results[5].reason || '', /next year exceeded 5 requestsPerMinute/);
  assert.ok(results[5].retryAfterMs > 0);
});

test('provider without requests per minute remains unlimited', async () => {
  resetProviderRateLimits();

  const provider = {
    uuid: 'provider-unlimited',
    customName: 'unlimited provider',
    rateLimits: {}
  };

  const results = await Promise.all(
    Array.from({ length: 20 }, async () => acquireProviderRateLimit(provider))
  );

  assert.equal(results.every((result) => result.allowed), true);
});
