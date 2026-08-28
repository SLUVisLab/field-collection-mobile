/**
 * Structured error type for {@link OdkCentralClient} operations.
 *
 * The client never throws bare `Error`s for protocol failures: every failure
 * that a caller might reasonably branch on (auth expiry, not found, conflict,
 * transient server/network error) carries a stable {@link OdkCentralError.code}
 * and a {@link OdkCentralError.retryable} hint so the composition root can build
 * retry/queue policy without string-matching messages.
 */

export const ODK_CENTRAL_ERROR_CODES = Object.freeze({
  /** Could not reach the server at all (DNS/TLS/socket/timeout). */
  NETWORK: 'ODK_CENTRAL_NETWORK',
  /** Request timed out client-side. */
  TIMEOUT: 'ODK_CENTRAL_TIMEOUT',
  /** 401/expired session/invalid credentials. */
  AUTH: 'ODK_CENTRAL_AUTH',
  /** 403 authenticated but not permitted. */
  FORBIDDEN: 'ODK_CENTRAL_FORBIDDEN',
  /** 404 resource missing. */
  NOT_FOUND: 'ODK_CENTRAL_NOT_FOUND',
  /** 409/412 conflict or precondition (e.g. duplicate submission instanceID). */
  CONFLICT: 'ODK_CENTRAL_CONFLICT',
  /** Entity update rejected because provided baseVersion is stale. */
  STALE_ENTITY_BASE_VERSION: 'ODK_CENTRAL_STALE_ENTITY_BASE_VERSION',
  /** A submission was rejected because its instanceID already exists with different XML. */
  DUPLICATE_INSTANCE: 'ODK_CENTRAL_DUPLICATE_INSTANCE',
  /** 400/422 the request was rejected as invalid. */
  BAD_REQUEST: 'ODK_CENTRAL_BAD_REQUEST',
  /** 5xx server-side failure. */
  SERVER: 'ODK_CENTRAL_SERVER',
  /** Caller misused the client (missing config, bad arguments). */
  CONFIG: 'ODK_CENTRAL_CONFIG',
  /** A response could not be parsed into the expected shape. */
  PARSE: 'ODK_CENTRAL_PARSE',
  /** Anything not otherwise classified. */
  GENERIC: 'ODK_CENTRAL_ERROR',
});

const RETRYABLE_CODES = new Set([
  ODK_CENTRAL_ERROR_CODES.NETWORK,
  ODK_CENTRAL_ERROR_CODES.TIMEOUT,
  ODK_CENTRAL_ERROR_CODES.SERVER,
]);

export class OdkCentralError extends Error {
  /**
   * @param {string} message
   * @param {{
   *   code?: string,
   *   httpStatus?: number | null,
   *   retryable?: boolean,
   *   details?: unknown,
   *   cause?: unknown
   * }} [options]
   */
  constructor(message, { code = ODK_CENTRAL_ERROR_CODES.GENERIC, httpStatus = null, retryable, details = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'OdkCentralError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = typeof retryable === 'boolean' ? retryable : RETRYABLE_CODES.has(code);
    this.details = details;
  }
}

/**
 * Redacts sensitive URL segments (App User `/key/<token>/` path and `st`/`token`
 * query params) so credentials never appear in error messages or logs.
 * @param {string} url
 * @returns {string}
 */
export const redactUrl = (url) => {
  if (typeof url !== 'string') {
    return url;
  }
  return url
    .replace(/(\/key\/)[^/?#]+/g, '$1<redacted>')
    .replace(/([?&](?:st|token)=)[^&#]+/g, '$1<redacted>');
};

/**
 * Maps an HTTP status code to a stable {@link ODK_CENTRAL_ERROR_CODES} value.
 * @param {number} status
 * @returns {string}
 */
export const codeForHttpStatus = (status) => {
  if (status === 401) return ODK_CENTRAL_ERROR_CODES.AUTH;
  if (status === 403) return ODK_CENTRAL_ERROR_CODES.FORBIDDEN;
  if (status === 404) return ODK_CENTRAL_ERROR_CODES.NOT_FOUND;
  if (status === 409 || status === 412) return ODK_CENTRAL_ERROR_CODES.CONFLICT;
  if (status === 400 || status === 422) return ODK_CENTRAL_ERROR_CODES.BAD_REQUEST;
  if (status >= 500) return ODK_CENTRAL_ERROR_CODES.SERVER;
  return ODK_CENTRAL_ERROR_CODES.GENERIC;
};

/**
 * Builds an {@link OdkCentralError} from a non-OK HTTP response.
 *
 * Central REST returns a JSON body `{ code, message, details }` on error; this
 * helper surfaces that as {@link OdkCentralError.details} when present.
 *
 * @param {{ status: number, url?: string }} response
 * @param {{ bodyText?: string | null, bodyJson?: any, openRosaMessage?: string | null }} [parsed]
 * @returns {OdkCentralError}
 */
export const errorFromResponse = (response, { bodyText = null, bodyJson = null, openRosaMessage = null } = {}) => {
  const status = response.status;
  const code = codeForHttpStatus(status);
  const serverMessage =
    (bodyJson && typeof bodyJson.message === 'string' && bodyJson.message) || openRosaMessage || null;
  const message =
    serverMessage != null
      ? `Central request failed (${status}): ${serverMessage}`
      : `Central request failed (${status})${response.url ? ` for ${redactUrl(response.url)}` : ''}`;
  return new OdkCentralError(message, {
    code,
    httpStatus: status,
    details: bodyJson ?? bodyText,
  });
};
