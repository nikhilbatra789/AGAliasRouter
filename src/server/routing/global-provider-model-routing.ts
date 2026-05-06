import type { CachedModel } from '../models/models-cache-service.ts';

type ProviderLike = {
  uuid: string;
  providerNumber?: string;
};

export function parseProviderNumberModel<TProvider extends ProviderLike>(modelName: string, providers: TProvider[]) {
  const slashIndex = modelName.indexOf('/');
  if (slashIndex <= 0) return null;
  const possibleProviderNumber = modelName.slice(0, slashIndex);
  const provider = providers.find((item) => item.providerNumber === possibleProviderNumber);
  if (!provider) return null;
  return {
    provider,
    upstreamModelName: modelName.slice(slashIndex + 1)
  };
}

export function findPlainProviderModel<TProvider extends ProviderLike>(
  modelName: string,
  providers: TProvider[],
  cachedModels: CachedModel[]
) {
  const providersByUuid = new Map(providers.map((provider) => [provider.uuid, provider]));
  for (const cachedModel of cachedModels) {
    if (cachedModel.id !== modelName) continue;
    const provider = providersByUuid.get(cachedModel.providerUuid);
    if (!provider) continue;
    return {
      provider,
      upstreamModelName: cachedModel.id
    };
  }
  return null;
}
