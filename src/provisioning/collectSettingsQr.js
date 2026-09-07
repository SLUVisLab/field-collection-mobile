/**
 * ODK Collect Settings QR parsing. This module is deliberately runtime-neutral:
 * the zlib/base64 implementation is injected so it can be tested in Node and
 * used in Expo without exposing QR contents to a native scanner or logger.
 */

export const MAX_QR_DECOMPRESSED_BYTES = 64 * 1024;

export class CollectSettingsQrError extends Error {
  constructor(message, { code = 'GATHER_QR_INVALID', reason = 'invalid-settings-qr' } = {}) {
    super(message);
    this.name = 'CollectSettingsQrError';
    this.code = code;
    // Reasons are deliberately categorical: never retain source QR text, decoded
    // payloads, URLs, or credentials in an error object that might be logged.
    this.details = { reason };
  }
}

const invalid = (reason) =>
  new CollectSettingsQrError('This is not a supported ODK Central Settings QR code.', { reason });

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const requireCodec = (codec) => {
  if (
    !codec ||
    typeof codec.decodeBase64 !== 'function' ||
    typeof codec.inflateZlib !== 'function'
  ) {
    throw invalid('codec-unavailable');
  }
  return codec;
};

const parseProjectId = (value) => {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw invalid('invalid-project-id');
  }
  const projectId = Number(value);
  if (!Number.isSafeInteger(projectId)) {
    throw invalid('invalid-project-id');
  }
  return projectId;
};

/**
 * Extract the Central base URL, App User token and numeric project ID from
 * precisely the endpoint emitted by Central:
 * `https://host/v1/key/<token>/projects/<numeric-project-id>`.
 *
 * @returns {{ baseUrl: string, projectId: number, token: string }}
 */
export const parseCentralAppUserUrl = (serverUrl) => {
  if (typeof serverUrl !== 'string' || serverUrl.length === 0) {
    throw invalid('missing-server-url');
  }

  let url;
  try {
    url = new URL(serverUrl);
  } catch {
    throw invalid('invalid-server-url');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw invalid('non-https-or-unsupported-server-url');
  }

  const match = /^\/v1\/key\/([^/]+)\/projects\/([0-9]+)$/.exec(url.pathname);
  if (!match) {
    throw invalid('unsupported-central-endpoint');
  }

  let token;
  try {
    token = decodeURIComponent(match[1]);
  } catch {
    throw invalid('invalid-app-user-token');
  }
  if (
    token.length === 0 ||
    /[\u0000-\u001f\u007f\s\\/]/.test(token)
  ) {
    throw invalid('invalid-app-user-token');
  }

  return {
    baseUrl: url.origin,
    projectId: parseProjectId(match[2]),
    token,
  };
};

const requireSettingsObjects = (settings) => {
  if (!isObject(settings)) throw invalid('settings-not-object');
  for (const field of ['general', 'admin', 'project']) {
    if (!isObject(settings[field])) {
      throw invalid(`missing-${field}`);
    }
  }
  if (hasOwn(settings.general, 'password') || hasOwn(settings.admin, 'admin_pw')) {
    throw invalid('unsupported-password-configuration');
  }
  if (typeof settings.general.server_url !== 'string') {
    throw invalid('missing-server-url');
  }
  return settings;
};

/**
 * Decode a Collect Settings QR payload. Standard padded base64 is required;
 * unpadded/base64url forms are rejected rather than guessed.
 *
 * `codec.inflateZlib()` receives the output ceiling so production codecs can
 * stop decompression before accepting a zip bomb. The postcondition protects
 * callers that supply a test codec which does not enforce it itself.
 *
 * @param {string} rawQrText secret source text; never retained or returned
 * @param {{ codec: { decodeBase64: Function, inflateZlib: Function } }} options
 * @returns {{ baseUrl: string, projectId: number, token: string, displayName: string | null }}
 */
export const parseCollectSettingsQr = (rawQrText, { codec } = {}) => {
  const decoder = requireCodec(codec);
  if (
    typeof rawQrText !== 'string' ||
    rawQrText.length === 0 ||
    rawQrText.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(rawQrText)
  ) {
    throw invalid('malformed-base64');
  }

  let compressed;
  try {
    compressed = decoder.decodeBase64(rawQrText);
  } catch {
    throw invalid('malformed-base64');
  }

  let jsonText;
  try {
    jsonText = decoder.inflateZlib(compressed, { maxOutputBytes: MAX_QR_DECOMPRESSED_BYTES });
  } catch {
    throw invalid('invalid-compressed-settings');
  }
  if (typeof jsonText !== 'string' || jsonText.length > MAX_QR_DECOMPRESSED_BYTES) {
    throw invalid('oversized-or-invalid-settings');
  }

  let settings;
  try {
    settings = JSON.parse(jsonText);
  } catch {
    throw invalid('invalid-settings-json');
  }

  const validated = requireSettingsObjects(settings);
  const extracted = parseCentralAppUserUrl(validated.general.server_url);
  const name =
    typeof validated.project.name === 'string' && validated.project.name.trim().length > 0
      ? validated.project.name.trim()
      : null;

  return { ...extracted, displayName: name };
};

/**
 * Safe diagnostics shape for UI telemetry. It intentionally excludes the App
 * User token as well as the raw and decoded Settings QR payloads.
 */
export const settingsQrLogDetails = ({ baseUrl, projectId, displayName }) => ({
  baseUrl,
  projectId,
  displayName,
});
