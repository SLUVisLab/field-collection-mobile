import { OdkCentralError, ODK_CENTRAL_ERROR_CODES, errorFromResponse } from './errors.js';

/**
 * OpenRosa clients must send this header on form-list, download and submission
 * requests. See https://docs.getodk.org/openrosa-http/
 */
export const OPEN_ROSA_VERSION_HEADER = 'X-OpenRosa-Version';
export const OPEN_ROSA_VERSION = '1.0';

const isAbortError = (error) =>
  error != null && (error.name === 'AbortError' || error.code === 'ABORT_ERR');

/**
 * Performs a single authenticated HTTP request over an injected `fetch`.
 *
 * This is the only place that talks to the network, which keeps the client
 * runtime-neutral (RN / Node) and fully testable with a mock `fetchImpl`. It
 * applies the auth transform, sets OpenRosa headers when requested, and maps
 * non-OK responses to {@link OdkCentralError}. On success it returns the raw
 * `Response` so callers can choose how to read the body (text / arrayBuffer).
 *
 * @param {{
 *   fetchImpl: typeof fetch,
 *   method: string,
 *   url: string,
 *   headers?: Record<string, string>,
 *   body?: any,
 *   auth?: import('./auth.js').OdkCentralAuth | null,
 *   openRosa?: boolean,
 *   accept?: string,
 *   timeoutMs?: number | null,
 *   signal?: AbortSignal
 * }} options
 * @returns {Promise<Response>}
 */
export const request = async ({
  fetchImpl,
  method,
  url,
  headers = {},
  body,
  auth = null,
  openRosa = false,
  accept,
  timeoutMs = null,
  signal,
}) => {
  if (typeof fetchImpl !== 'function') {
    throw new OdkCentralError('No fetch implementation available', {
      code: ODK_CENTRAL_ERROR_CODES.CONFIG,
    });
  }

  let requestHeaders = { ...headers };
  if (openRosa) {
    requestHeaders[OPEN_ROSA_VERSION_HEADER] = OPEN_ROSA_VERSION;
  }
  if (accept) {
    requestHeaders.Accept = accept;
  }

  let requestUrl = url;
  if (auth != null) {
    const applied = auth.applyToRequest({ url: requestUrl, headers: requestHeaders });
    requestUrl = applied.url;
    requestHeaders = applied.headers;
  }

  // Timeout via AbortController when the runtime supports it.
  let timeoutSignal = signal;
  let timer = null;
  if (timeoutMs != null && typeof AbortController === 'function') {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    timeoutSignal = controller.signal;
  }

  let response;
  try {
    response = await fetchImpl(requestUrl, {
      method,
      headers: requestHeaders,
      body,
      signal: timeoutSignal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new OdkCentralError(`Request timed out: ${method} ${requestUrl}`, {
        code: ODK_CENTRAL_ERROR_CODES.TIMEOUT,
        cause: error,
      });
    }
    throw new OdkCentralError(`Network error: ${method} ${requestUrl}`, {
      code: ODK_CENTRAL_ERROR_CODES.NETWORK,
      cause: error,
    });
  } finally {
    if (timer != null) {
      clearTimeout(timer);
    }
  }

  if (!response.ok) {
    const bodyText = await safeText(response);
    let bodyJson = null;
    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      bodyJson = null;
    }
    throw errorFromResponse(response, { bodyText, bodyJson });
  }

  return response;
};

/**
 * Reads a response body as text without throwing.
 * @param {Response} response
 * @returns {Promise<string | null>}
 */
export const safeText = async (response) => {
  try {
    return await response.text();
  } catch {
    return null;
  }
};

/**
 * Reads and parses a JSON response body, mapping parse failures to a stable
 * {@link OdkCentralError} code.
 * @param {Response} response
 * @returns {Promise<any>}
 */
export const readJson = async (response) => {
  const text = await safeText(response);
  if (text == null || text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new OdkCentralError('Failed to parse Central JSON response', {
      code: ODK_CENTRAL_ERROR_CODES.PARSE,
      cause: error,
      details: text.slice(0, 500),
    });
  }
};
