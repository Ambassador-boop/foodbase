import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { ApiErrorBody } from './errors';

/**
 * The last line of defence in a route.
 *
 * An error nobody planned for must not reach the browser as a stack trace, a
 * SQL message, or a provider payload. It is logged once, on the server, with a
 * request id; the caller gets a generic 500 carrying that same id, so a support
 * conversation can start from a screenshot.
 *
 * What is logged is the route, the request id and the error's message. Never a
 * request body, a token, a connection string or a provider secret.
 */

/** The id the platform or the client already attached, or a fresh one. */
export function requestIdFrom(request?: Request): string {
  const header = request?.headers?.get('x-request-id');
  if (header && /^[A-Za-z0-9._-]{6,100}$/.test(header)) return header;
  return randomUUID();
}

export interface UnexpectedOptions {
  /** Where it happened, e.g. 'POST /api/orders'. Used in the log line only. */
  where: string;
  request?: Request;
}

/**
 * Logs and answers an unexpected error.
 *
 * Usage:
 *     } catch (error) {
 *       return handleUnexpected(error, { where: 'POST /api/orders', request });
 *     }
 */
export function handleUnexpected(error: unknown, options: UnexpectedOptions): NextResponse {
  const requestId = requestIdFrom(options.request);
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[api] ${options.where} failed (request ${requestId}): ${message}`);

  const body: ApiErrorBody = {
    code: 'INTERNAL_ERROR',
    message: `Something went wrong on our side. Reference ${requestId}.`,
    requestId,
  };
  return NextResponse.json({ error: body }, { status: 500 });
}

/** Header set on every response so a client can report the id it saw. */
export const REQUEST_ID_HEADER = 'x-request-id';
