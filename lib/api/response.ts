import { NextResponse } from 'next/server';
import type { ApiErrorBody, ApiErrorFields } from './errors';

/**
 * Successful responses.
 *
 * `ok` exists so a route reads the same at both ends: `return ok(data)` for the
 * usual 200, `return ok(data, { status: 201 })` where the status matters.
 * Success bodies are whatever the caller passes: this batch does not change the
 * shape of any successful response.
 */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/**
 * An error response in the standard envelope.
 *
 * `code` is stable and machine-readable (`VALIDATION_ERROR`, `PIN_REQUIRED`,
 * `RATE_LIMITED`, …), `message` is the sentence a person should see, and
 * `fields` maps a form field to its messages.
 */
export function fail(
  code: string,
  message: string,
  status: number,
  fields?: ApiErrorFields,
  details?: Record<string, unknown>,
): NextResponse {
  const body: ApiErrorBody = { code, message, ...(fields ? { fields } : {}), ...(details ? { details } : {}) };
  return NextResponse.json({ error: body }, { status });
}

/** 401 with the standard envelope. */
export function unauthorized(message = 'Please sign in again.'): NextResponse {
  return fail('UNAUTHORIZED', message, 401);
}

/** 403 for an action the caller is not allowed to take. */
export function forbidden(message = 'You do not have access to this.'): NextResponse {
  return fail('FORBIDDEN', message, 403);
}

/** 404 with the standard envelope. */
export function notFound(message = 'Not found.'): NextResponse {
  return fail('NOT_FOUND', message, 404);
}
