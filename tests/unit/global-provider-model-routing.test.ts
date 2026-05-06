import assert from 'node:assert/strict';
import test from 'node:test';
import { findPlainProviderModel, parseProviderNumberModel } from '../../src/server/routing/global-provider-model-routing.ts';

const providers = [
  {
    uuid: 'provider-11',
    providerNumber: 'P11',
    customName: 'primary',
    family: 'openai-custom',
    enabled: true,
    health: 'healthy'
  },
  {
    uuid: 'provider-12',
    providerNumber: 'P12',
    customName: 'secondary',
    family: 'openai-custom',
    enabled: true,
    health: 'healthy'
  }
] as any[];

test('provider number routing uses only the first slash and preserves slashes in upstream model names', () => {
  const route = parseProviderNumberModel('P11/org/model/name', providers);

  assert.equal(route?.provider.uuid, 'provider-11');
  assert.equal(route?.upstreamModelName, 'org/model/name');
});

test('provider number routing does not guess; it only matches existing provider numbers', () => {
  const route = parseProviderNumberModel('P999/gpt-5.3', providers);

  assert.equal(route, null);
});

test('plain provider model lookup can fallback to a cached model containing slashes', () => {
  const route = findPlainProviderModel('P999/gpt-5.3', providers, [
    {
      id: 'P999/gpt-5.3',
      object: 'model',
      owned_by: 'P12',
      provider: 'secondary',
      providerFamily: 'openai-custom',
      providerUuid: 'provider-12',
      providerCustomName: 'secondary',
      source: 'api'
    }
  ]);

  assert.equal(route?.provider.uuid, 'provider-12');
  assert.equal(route?.upstreamModelName, 'P999/gpt-5.3');
});

test('plain provider model lookup picks the provider that owns the cached model', () => {
  const route = findPlainProviderModel('gpt-5.3', providers, [
    {
      id: 'gpt-5.3',
      object: 'model',
      owned_by: 'P12',
      provider: 'secondary',
      providerFamily: 'openai-custom',
      providerUuid: 'provider-12',
      providerCustomName: 'secondary',
      source: 'api'
    }
  ]);

  assert.equal(route?.provider.uuid, 'provider-12');
  assert.equal(route?.upstreamModelName, 'gpt-5.3');
});
