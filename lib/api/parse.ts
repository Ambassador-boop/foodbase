import type { NextResponse } from 'next/server';
import type { ZodType, ZodTypeDef } from 'zod';
import { ZodError } from 'zod';
import type { ApiErrorFields } from './errors';
import { fail } from './response';

/**
 * Request parsing, so no route reads `request.json()` unvalidated.
 *
 * Both helpers answer with a discriminated union:
 *
 *     const parsed = await parseBody(request, CreateOrderBody);
 *     if (!parsed.ok) return parsed.response;
 *     parsed.data // fully typed
 *
 * A Zod failure is a 422 with one message list per field. Malformed JSON is a
 * 400: it is not a validation problem the person can fix in a field.
 */

export type ParseFailure = { ok: false; response: NextResponse };
export type ParseSuccess<T> = { ok: true; data: T };
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

/** `{ email: ['Invalid email'], amount: ['Expected number'] }` */
export function zodFields(error: ZodError): ApiErrorFields {
  const fields: ApiErrorFields = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_';
    if (!fields[key]) fields[key] = [];
    fields[key].push(issue.message);
  }
  return fields;
}

/** 422 for a schema failure, with the field messages attached. */
export function validationFailure(error: ZodError, message = 'Please check the highlighted fields.'): NextResponse {
  return fail('VALIDATION_ERROR', message, 422, zodFields(error));
}

export async function parseBody<T>(
  request: Request,
  schema: ZodType<T, ZodTypeDef, unknown>,
  message = 'Please check the highlighted fields.',
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail('INVALID_JSON', 'The request body was not valid JSON.', 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: validationFailure(parsed.error, message) };
  return { ok: true, data: parsed.data };
}

/**
 * Query parameters as a plain object, then validated.
 *
 * Repeated keys become arrays (`?tag=a&tag=b`), which is what a filter expects;
 * a single value stays a string.
 */
export function queryObject(url: string | URL): Record<string, string | string[]> {
  const params = new URL(url).searchParams;
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

export function parseQuery<T>(
  request: Request | string | URL,
  schema: ZodType<T, ZodTypeDef, unknown>,
  message = 'Please check the filters you sent.',
): ParseResult<T> {
  const url = typeof request === 'string' || request instanceof URL ? request : request.url;
  const parsed = schema.safeParse(queryObject(url));
  if (!parsed.success) return { ok: false, response: validationFailure(parsed.error, message) };
  return { ok: true, data: parsed.data };
}

/** Route params (`[refundId]`) are input too; they get the same treatment. */
export function parseParams<T>(
  params: unknown,
  schema: ZodType<T, ZodTypeDef, unknown>,
  message = 'That address is not valid.',
): ParseResult<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) return { ok: false, response: validationFailure(parsed.error, message) };
  return { ok: true, data: parsed.data };
}
