import { NextResponse } from 'next/server';
import { ConfigParseError } from '@/server/config/json-store';

export function uiError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof ConfigParseError ? 'CONFIG_PARSE_ERROR' : status === 400 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function openAIError(message: string, status: number, type = 'invalid_request_error') {
  return NextResponse.json(
    {
      error: {
        message,
        type,
        code: type
      }
    },
    { status }
  );
}

export function anthropicError(message: string, status: number, type = 'invalid_request_error') {
  return NextResponse.json(
    {
      type: 'error',
      error: {
        type,
        message
      }
    },
    { status }
  );
}
