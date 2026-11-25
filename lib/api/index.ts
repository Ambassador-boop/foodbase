/**
 * API conventions for this app.
 *
 *   import { ok, fail, parseBody, parseQuery, handleUnexpected } from '@/lib/api';
 *
 * Server-only: `ok`, `fail` and `handleUnexpected` build NextResponse objects.
 * Client components that need to read an error should import from
 * '@/lib/api/errors' instead (`apiErrorMessage`, `apiErrorCode`), which pulls in
 * nothing from next/server.
 */

export { ok, fail, unauthorized, forbidden, notFound } from './response';
export {
  parseBody,
  parseQuery,
  parseParams,
  queryObject,
  zodFields,
  validationFailure,
} from './parse';
export type { ParseResult, ParseSuccess, ParseFailure } from './parse';
export { handleUnexpected, requestIdFrom, REQUEST_ID_HEADER } from './handler';
export type { UnexpectedOptions } from './handler';
export {
  apiErrorMessage,
  apiErrorCode,
  apiErrorFields,
  apiErrorDetails,
  isApiErrorPayload,
} from './errors';
export type { ApiErrorBody, ApiErrorFields, ApiErrorPayload } from './errors';
