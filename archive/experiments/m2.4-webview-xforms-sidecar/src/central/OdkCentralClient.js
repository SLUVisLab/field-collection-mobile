import { normalizeConfig, createEndpoints } from './config.js';
import { OdkCentralError, ODK_CENTRAL_ERROR_CODES } from './errors.js';
import { request, readJson, safeText, OPEN_ROSA_VERSION_HEADER } from './http.js';
import {
  parseFormList,
  parseManifest,
  parseOpenRosaResponse,
  buildSubmissionParts,
  toFormData,
  extractInstanceId,
} from './openrosa.js';

/**
 * The smallest useful ODK Central client for a mobile data-collection workflow.
 *
 * It covers exactly the M4 vertical slice — discover forms, download a form's
 * XML, list/download its attachments, and submit a filled instance back — built
 * directly on Central's documented REST + OpenRosa protocols. It is deliberately
 * **not** a pyODK-style wrapper for every endpoint: extend it only when a real
 * product workflow requires it.
 *
 * Boundaries (see package README): no XForms evaluation, no React, no WebView,
 * no persistence, no offline queue, no media processing. Attachment bytes are
 * passed through as opaque references supplied by the host app.
 *
 * @example
 * const central = new OdkCentralClient({
 *   baseUrl: 'https://central.example.org',
 *   projectId: 1,
 *   auth: createAppUserAuth(appUserToken),
 * });
 * const forms = await central.listForms();
 * const xml = await central.downloadForm({ formId: 'my-form' });
 * // ... render + edit via odk-xforms-react, then serialize ...
 * await central.submit({ xml: submissionXml, attachments });
 */
export class OdkCentralClient {
  /**
   * @param {{
   *   baseUrl: string,
   *   projectId?: number | string,
   *   auth?: import('./auth.js').OdkCentralAuth,
   *   fetch?: typeof fetch,
   *   FormData?: typeof FormData,
   *   timeoutMs?: number | null
   * }} options
   */
  constructor({ baseUrl, projectId, auth, fetch: fetchImpl, FormData: FormDataImpl, timeoutMs = null } = {}) {
    this.config = normalizeConfig({ baseUrl, projectId, auth });
    this.endpoints = createEndpoints(this.config);
    this.auth = this.config.auth;
    this.fetchImpl = fetchImpl ?? globalThis.fetch;
    this.FormDataImpl = FormDataImpl ?? globalThis.FormData;
    this.timeoutMs = timeoutMs;
    if (typeof this.fetchImpl !== 'function') {
      throw new OdkCentralError('OdkCentralClient requires a fetch implementation', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
  }

  /**
   * Ensures the client has a usable credential. For session auth this performs
   * the `POST /v1/sessions` login (once) and stores the returned bearer token.
   * Other strategies are ready immediately.
   * @returns {Promise<void>}
   */
  async ensureAuth() {
    if (this.auth == null || !this.auth.requiresLogin) {
      return;
    }
    if (typeof this.auth.getToken === 'function' && this.auth.getToken() != null) {
      return;
    }
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'POST',
      url: this.endpoints.sessions(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.auth.credentials),
      auth: null,
      timeoutMs: this.timeoutMs,
    });
    const body = await readJson(response);
    if (body == null || typeof body.token !== 'string') {
      throw new OdkCentralError('Session login did not return a token', {
        code: ODK_CENTRAL_ERROR_CODES.AUTH,
        details: body,
      });
    }
    this.auth.setToken(body.token);
  }

  /**
   * Reads the Central deployment version file (`{baseUrl}/version.txt`).
   * @returns {Promise<string | null>}
   */
  async getServerVersion() {
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.serverVersion(),
      auth: this.auth,
      timeoutMs: this.timeoutMs,
    });
    return safeText(response);
  }

  /**
   * Probes OpenRosa capabilities by reading the response headers of the form
   * list endpoint.
   * @param {{ projectId?: number | string }} [params]
   * @returns {Promise<{ openRosaVersion: string | null, acceptContentLength: string | null }>}
   */
  async getCapabilities({ projectId } = {}) {
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.formList(projectId),
      auth: this.auth,
      openRosa: true,
      timeoutMs: this.timeoutMs,
    });
    return {
      openRosaVersion: response.headers.get(OPEN_ROSA_VERSION_HEADER),
      acceptContentLength: response.headers.get('X-OpenRosa-Accept-Content-Length'),
    };
  }

  /**
   * Lists forms available in a project via the OpenRosa form list.
   * @param {{ projectId?: number | string }} [params]
   * @returns {Promise<import('./openrosa.js').OpenRosaFormListing[]>}
   */
  async listForms({ projectId } = {}) {
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.formList(projectId),
      auth: this.auth,
      openRosa: true,
      timeoutMs: this.timeoutMs,
    });
    const xml = await safeText(response);
    return parseFormList(xml ?? '');
  }

  /**
   * Downloads a form's XForms XML definition (REST `.../forms/:xmlFormId.xml`).
   * @param {{ formId: string, projectId?: number | string }} params
   * @returns {Promise<string>}
   */
  async downloadForm({ formId, projectId } = {}) {
    if (typeof formId !== 'string' || formId.length === 0) {
      throw new OdkCentralError('downloadForm requires a formId', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.formXml(projectId, formId),
      auth: this.auth,
      accept: 'application/xml',
      timeoutMs: this.timeoutMs,
    });
    const xml = await safeText(response);
    if (xml == null || xml.trim().length === 0) {
      throw new OdkCentralError(`Form "${formId}" returned an empty XML body`, {
        code: ODK_CENTRAL_ERROR_CODES.PARSE,
      });
    }
    return xml;
  }

  /**
   * Discovers a form's media/data resources via the **OpenRosa Form Manifest**
   * (`GET /v1/projects/:id/forms/:xmlFormId/manifest`).
   *
   * This is the **field-client path** and works with App User authentication —
   * it is the primary Gather Mobile resource-discovery mechanism. It is *not*
   * interchangeable with {@link OdkCentralClient.listFormAttachments}, which is
   * the Central REST/admin surface and requires Web User authorization.
   *
   * Returns `[]` for a form with no attachments (Central answers the manifest
   * endpoint with an empty `<manifest>` even when `formList` advertises no
   * `manifestUrl`). Each entry's `downloadUrl` points at the resource; fetch the
   * bytes with {@link OdkCentralClient.downloadFormAttachment}.
   *
   * @param {{ formId: string, projectId?: number | string }} params
   * @returns {Promise<import('./openrosa.js').OpenRosaManifestEntry[]>}
   */
  async getFormManifest({ formId, projectId } = {}) {
    if (typeof formId !== 'string' || formId.length === 0) {
      throw new OdkCentralError('getFormManifest requires a formId', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.formManifest(projectId, formId),
      auth: this.auth,
      openRosa: true,
      timeoutMs: this.timeoutMs,
    });
    const xml = await safeText(response);
    return parseManifest(xml ?? '');
  }

  /**
   * Lists a form's expected media/data attachments via the **Central REST**
   * surface (`GET /v1/projects/:id/forms/:xmlFormId/attachments`).
   *
   * This is the **admin/form-management path** and requires **Web User**
   * authorization — App Users receive `403` here. For the field-client (App
   * User) resource-discovery flow, use {@link OdkCentralClient.getFormManifest}
   * instead. The two are intentionally distinct protocol surfaces and are not
   * interchangeable.
   *
   * @param {{ formId: string, projectId?: number | string }} params
   * @returns {Promise<any[]>}
   */
  async listFormAttachments({ formId, projectId } = {}) {
    if (typeof formId !== 'string' || formId.length === 0) {
      throw new OdkCentralError('listFormAttachments requires a formId', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.formAttachments(projectId, formId),
      auth: this.auth,
      accept: 'application/json',
      timeoutMs: this.timeoutMs,
    });
    const body = await readJson(response);
    return Array.isArray(body) ? body : [];
  }

  /**
   * Downloads a single form attachment. Returns the raw `Response` so the host
   * app decides how to persist the bytes (stream to disk, etc.) — the client
   * does not buffer or process media.
   * @param {{ formId: string, filename: string, projectId?: number | string }} params
   * @returns {Promise<Response>}
   */
  async downloadFormAttachment({ formId, filename, projectId } = {}) {
    if (!formId || !filename) {
      throw new OdkCentralError('downloadFormAttachment requires formId and filename', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    await this.ensureAuth();
    return request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.formAttachment(projectId, formId, filename),
      auth: this.auth,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Submits a filled instance to a project via the OpenRosa Submission API.
   *
   * On success Central returns `201` with an `OpenRosaResponse` message. Two
   * failure modes are given stable, non-retryable classifications:
   * - a resend of the same `instanceId` with **different** XML → `409`, mapped
   *   to {@link ODK_CENTRAL_ERROR_CODES.DUPLICATE_INSTANCE};
   * - a malformed/invalid submission → `400`, mapped to `BAD_REQUEST`.
   * (A resend with an **identical** `xml_submission_file` is idempotent and
   * succeeds again with `201` — that is how additional media parts are attached.)
   *
   * @param {{
   *   xml: string,
   *   attachments?: import('./openrosa.js').SubmissionAttachment[],
   *   projectId?: number | string
   * }} params
   * @returns {Promise<{ status: number, message: string | null, instanceId: string | null }>}
   */
  async submit({ xml, attachments = [], projectId } = {}) {
    await this.ensureAuth();
    const instanceId = extractInstanceId(xml);
    const parts = buildSubmissionParts({ xml, attachments });
    const body = toFormData(parts, { FormDataImpl: this.FormDataImpl });
    let response;
    try {
      response = await request({
        fetchImpl: this.fetchImpl,
        method: 'POST',
        url: this.endpoints.submission(projectId),
        auth: this.auth,
        openRosa: true,
        body,
        timeoutMs: this.timeoutMs,
      });
    } catch (error) {
      // A 409 on submission specifically means "instanceId already exists with
      // different XML" — surface a dedicated, non-retryable code.
      if (error instanceof OdkCentralError && error.httpStatus === 409) {
        throw new OdkCentralError(error.message, {
          code: ODK_CENTRAL_ERROR_CODES.DUPLICATE_INSTANCE,
          httpStatus: 409,
          retryable: false,
          details: error.details,
          cause: error,
        });
      }
      throw error;
    }
    const responseXml = await safeText(response);
    return {
      status: response.status,
      message: parseOpenRosaResponse(responseXml).message,
      instanceId,
    };
  }
}
