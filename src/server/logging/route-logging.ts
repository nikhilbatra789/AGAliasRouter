import { appendLog } from '@/server/logging/log-service';

type RouteLogInput = {
  route: string;
  status: number;
  latencyMs: number;
  provider?: string;
  model?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  requestBodyLoggingEnabled?: boolean;
};

function scrubString(input: string) {
  return input
    .replace(/Bearer\s+([A-Za-z0-9._-]+)/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]');
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item));
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (/^(authorization|x-api-key|api[-_]?key)$/i.test(key)) {
        next[key] = '[redacted]';
      } else {
        next[key] = scrubValue(val);
      }
    }
    return next;
  }
  return value;
}

function stringifyBody(body: unknown) {
  try {
    return JSON.stringify(scrubValue(body));
  } catch {
    return '[unserializable]';
  }
}

function encodeBody(body: unknown) {
  return encodeURIComponent(stringifyBody(body));
}

export async function logRouteEvent(input: RouteLogInput) {
  const fields = [
    `route=${input.route}`,
    `status=${input.status}`,
    `latencyMs=${input.latencyMs}`
  ];
  if (input.provider) fields.push(`provider=${input.provider}`);
  if (input.model) fields.push(`model=${input.model}`);
  if (input.requestHeaders !== undefined) {
    fields.push(`requestHeadersEncoded=${encodeBody(input.requestHeaders)}`);
  }
  if (input.requestBody !== undefined) {
    fields.push(`requestBodyEncoded=${encodeBody(input.requestBody)}`);
  }
  if (input.responseBody !== undefined) {
    fields.push(`responseBodyEncoded=${encodeBody(input.responseBody)}`);
  }
  const lvl = input.status >= 500 ? 'ERROR' : input.status >= 400 ? 'WARN' : 'INFO';
  await appendLog(lvl, fields.join(' '));
}
