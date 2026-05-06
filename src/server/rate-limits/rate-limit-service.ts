import type { Provider } from '@/shared/types';

type RateLimitWindow = {
  name: 'requestsPerMinute';
  windowMs: number;
  max: number;
};

type RateLimitCheck = {
  allowed: boolean;
  retryAfterMs: number;
  reason?: string;
};

const providerBuckets = new Map<string, number[]>();

function windowsForProvider(provider: Pick<Provider, 'rateLimits'>): RateLimitWindow[] {
  const requestsPerMinute = provider.rateLimits?.requestsPerMinute;
  if (!Number.isInteger(requestsPerMinute) || !requestsPerMinute || requestsPerMinute <= 0) return [];
  return [
    {
      name: 'requestsPerMinute',
      windowMs: 60_000,
      max: requestsPerMinute
    }
  ];
}

function bucketKey(provider: Pick<Provider, 'uuid'>) {
  return `provider:${provider.uuid}`;
}

function pruneBucket(bucket: number[], now: number, maxWindowMs: number) {
  const oldestAllowed = now - maxWindowMs;
  while (bucket.length && bucket[0] <= oldestAllowed) {
    bucket.shift();
  }
}

export function checkProviderRateLimit(provider: Pick<Provider, 'uuid' | 'customName' | 'rateLimits'>): RateLimitCheck {
  const windows = windowsForProvider(provider);
  if (!windows.length) return { allowed: true, retryAfterMs: 0 };

  const now = Date.now();
  const maxWindowMs = Math.max(...windows.map((window) => window.windowMs));
  const bucket = providerBuckets.get(bucketKey(provider)) || [];
  pruneBucket(bucket, now, maxWindowMs);
  providerBuckets.set(bucketKey(provider), bucket);

  for (const window of windows) {
    const count = bucket.filter((timestamp) => timestamp > now - window.windowMs).length;
    if (count >= window.max) {
      const oldestInWindow = bucket.find((timestamp) => timestamp > now - window.windowMs) || now;
      return {
        allowed: false,
        retryAfterMs: Math.max(1, oldestInWindow + window.windowMs - now),
        reason: `${provider.customName} exceeded ${window.max} ${window.name}.`
      };
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

export function acquireProviderRateLimit(provider: Pick<Provider, 'uuid' | 'customName' | 'rateLimits'>): RateLimitCheck {
  const check = checkProviderRateLimit(provider);
  if (!check.allowed) return check;

  const windows = windowsForProvider(provider);
  if (!windows.length) return check;

  const now = Date.now();
  const key = bucketKey(provider);
  const bucket = providerBuckets.get(key) || [];
  bucket.push(now);
  providerBuckets.set(key, bucket);
  return check;
}

export function releaseProviderRateLimit(provider: Pick<Provider, 'uuid' | 'rateLimits'>) {
  if (!windowsForProvider(provider).length) return;
  const key = bucketKey(provider);
  const bucket = providerBuckets.get(key);
  if (!bucket?.length) return;
  bucket.pop();
}

export function resetProviderRateLimits() {
  providerBuckets.clear();
}
