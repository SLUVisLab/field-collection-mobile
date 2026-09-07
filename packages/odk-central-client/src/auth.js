import { OdkCentralError, ODK_CENTRAL_ERROR_CODES } from './errors.js';

/**
 * An `OdkCentralAuth` describes how a request is authenticated. It is applied
 * as a pure transform over `{ url, headers }` so a strategy may either add a
 * header (bearer/basic) or rewrite the URL (App User "actuated" key path).
 *
 * @typedef {{
 *   scheme: 'bearer' | 'session' | 'appUser' | 'basic' | 'none',
 *   requiresLogin: boolean,
 *   applyToRequest: (request: { url: string, headers: Record<string, string> }) => { url: string, headers: Record<string, string> }
 * }} OdkCentralAuth
 */

const authError = (message) =>
  new OdkCentralError(message, { code: ODK_CENTRAL_ERROR_CODES.CONFIG });

/**
 * Runtime-neutral base64 (RN Hermes lacks `Buffer`; Node lacks `btoa` in some
 * modes). Prefers `btoa`, falls back to `Buffer`.
 * @param {string} input
 * @returns {string}
 */
export const toBase64 = (input) => {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(input);
  }
  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(input, 'utf-8').toString('base64');
  }
  throw authError('No base64 encoder available in this runtime');
};

/**
 * Bearer token auth (e.g. a previously obtained Central session token).
 * @param {string} token
 * @returns {OdkCentralAuth}
 */
export const createBearerAuth = (token) => {
  if (typeof token !== 'string' || token.length === 0) {
    throw authError('createBearerAuth requires a non-empty token');
  }
  return {
    scheme: 'bearer',
    requiresLogin: false,
    applyToRequest: ({ url, headers }) => ({
      url,
      headers: { ...headers, Authorization: `Bearer ${token}` },
    }),
  };
};

/**
 * Basic auth (web-user email/password). Useful for tests and simple setups;
 * prefer {@link createSessionAuth} in production.
 * @param {{ email: string, password: string }} credentials
 * @returns {OdkCentralAuth}
 */
export const createBasicAuth = ({ email, password } = {}) => {
  if (!email || !password) {
    throw authError('createBasicAuth requires email and password');
  }
  const encoded = toBase64(`${email}:${password}`);
  return {
    scheme: 'basic',
    requiresLogin: false,
    applyToRequest: ({ url, headers }) => ({
      url,
      headers: { ...headers, Authorization: `Basic ${encoded}` },
    }),
  };
};

/**
 * App User auth — the standard field-collection path. Central actuates an App
 * User token by prefixing the API path with `/key/<token>`, e.g.
 * `https://host/v1/key/<token>/projects/1/formList`.
 *
 * @param {string} token
 * @returns {OdkCentralAuth}
 */
export const createAppUserAuth = (token) => {
  if (typeof token !== 'string' || token.length === 0) {
    throw authError('createAppUserAuth requires a non-empty token');
  }
  return {
    scheme: 'appUser',
    requiresLogin: false,
    applyToRequest: ({ url, headers }) => ({
      // Insert `/key/<token>` immediately after the `/v1` path segment.
      url: url.replace(/(\/v1)(\/|$)/, `$1/key/${encodeURIComponent(token)}$2`),
      headers,
    }),
  };
};

/**
 * Web-user session auth. Requires a login step (`POST /v1/sessions`) to obtain
 * a session token; {@link OdkCentralClient.ensureAuth} performs it. Until a
 * token is set, {@link OdkCentralAuth.applyToRequest} is a no-op.
 *
 * @param {{ email: string, password: string }} credentials
 * @returns {OdkCentralAuth & { credentials: { email: string, password: string }, setToken: (token: string) => void, getToken: () => string | null }}
 */
export const createSessionAuth = ({ email, password } = {}) => {
  if (!email || !password) {
    throw authError('createSessionAuth requires email and password');
  }
  let token = null;
  return {
    scheme: 'session',
    requiresLogin: true,
    credentials: { email, password },
    setToken(next) {
      token = next;
    },
    getToken() {
      return token;
    },
    applyToRequest: ({ url, headers }) => ({
      url,
      headers: token == null ? headers : { ...headers, Authorization: `Bearer ${token}` },
    }),
  };
};

/**
 * No-op auth (anonymous / open endpoints).
 * @returns {OdkCentralAuth}
 */
export const createNoAuth = () => ({
  scheme: 'none',
  requiresLogin: false,
  applyToRequest: (request) => request,
});
