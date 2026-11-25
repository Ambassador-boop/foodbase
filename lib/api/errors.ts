/**
 * The error envelope, as a pure module.
 *
 * Every API error in this app has the shape
 *     { error: { code, message, fields? } }
 * so a caller can branch on `code` and show `message` without guessing.
 *
 * This file deliberately imports nothing from `next/server`: client components
 * import `apiErrorMessage` to render the right sentence, and pulling the server
 * response helpers into a browser bundle would break the build.
 */

/** Field name to the messages that failed on it. */
export type ApiErrorFields = Record<string, string[]>;

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: ApiErrorFields;
  /**
   * Machine-readable extras the UI needs to react precisely: the restaurant's
   * next opening time, the tables still available, the server's own price
   * breakdown. Never secrets, never a stack trace.
   */
  details?: Record<string, unknown>;
  /** Present on an unexpected 500 so a log line can be found from a screenshot. */
  requestId?: string;
}

export interface ApiErrorPayload {
  error: ApiErrorBody;
}

/** Narrows an unknown JSON body to the error envelope. */
export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = (value as { error?: unknown }).error;
  return Boolean(candidate) && typeof candidate === 'object' && typeof (candidate as ApiErrorBody).message === 'string';
}

/**
 * The sentence to show a person for any error response.
 *
 * Accepts the current envelope and, for older endpoints that were not converted
 * in this batch, the plain `{ error: 'text' }` shape. Falls back to the caller's
 * own copy when there is nothing usable, so a screen never goes blank.
 */
export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (isApiErrorPayload(payload)) {
    const { message, fields } = payload.error;
    const firstField = fields ? Object.values(fields)[0]?.[0] : undefined;
    return firstField || message || fallback;
  }
  if (payload && typeof payload === 'object') {
    const legacy = (payload as { error?: unknown }).error;
    if (typeof legacy === 'string' && legacy.trim()) return legacy;
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

/** Machine-readable code for an error body, if it has one. */
export function apiErrorCode(payload: unknown): string | null {
  return isApiErrorPayload(payload) ? payload.error.code : null;
}

/** Structured extras attached to an error, if any. */
export function apiErrorDetails(payload: unknown): Record<string, unknown> {
  return isApiErrorPayload(payload) ? payload.error.details ?? {} : {};
}

/** Field messages, for inline form errors. Empty object when there are none. */
export function apiErrorFields(payload: unknown): ApiErrorFields {
  return isApiErrorPayload(payload) ? payload.error.fields ?? {} : {};
}
