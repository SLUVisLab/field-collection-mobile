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

  /**
   * Lists project-scoped Actor Property names.
   *
   * Actor Properties are attached to App Users/Public Links and can be used by
   * Dataset `accessFilter` rules (M4.7 delivery filtering).
   *
   * @param {{ projectId?: number | string, extendedMetadata?: boolean }} [params]
   * @returns {Promise<any[]>} raw Central actor-property rows.
   */
  async listActorProperties({ projectId, extendedMetadata = false } = {}) {
    await this.ensureAuth();
    const headers = extendedMetadata ? { 'X-Extended-Metadata': 'true' } : {};
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.actorProperties(projectId),
      auth: this.auth,
      headers,
      accept: 'application/json',
      timeoutMs: this.timeoutMs,
    });
    const body = await readJson(response);
    return Array.isArray(body) ? body : [];
  }

  /**
   * Registers a project-scoped Actor Property name.
   *
   * @param {{ name: string, projectId?: number | string }} params
   * @returns {Promise<any>} raw Central success payload.
   */
  async registerActorProperty({ name, projectId } = {}) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new OdkCentralError('registerActorProperty requires a non-empty property name', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'POST',
      url: this.endpoints.actorProperties(projectId),
      auth: this.auth,
      headers: { 'Content-Type': 'application/json' },
      accept: 'application/json',
      body: JSON.stringify({ name }),
      timeoutMs: this.timeoutMs,
    });
    return readJson(response);
  }

  /**
   * Lists a project's Entity Lists (Datasets).
   *
   * "Dataset" is the Central developer-API term; the Central UI calls these
   * "Entity Lists". This is the **REST/admin** surface (Web User) — App Users
   * receive `403`. The field-client path never lists Datasets directly; it
   * discovers a linked Entity-List CSV via the OpenRosa form manifest.
   *
   * @param {{ projectId?: number | string }} [params]
   * @returns {Promise<any[]>} the raw Central Dataset summaries (pass-through).
   */
  async listDatasets({ projectId } = {}) {
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.datasets(projectId),
      auth: this.auth,
      accept: 'application/json',
      timeoutMs: this.timeoutMs,
    });
    const body = await readJson(response);
    return Array.isArray(body) ? body : [];
  }

  /**
   * Gets one Dataset's detail — property schema, linked/source forms, and
   * update metadata — from the REST/admin surface.
   *
   * @param {{ name: string, projectId?: number | string }} params
   * @returns {Promise<any>} the raw Central Dataset detail (pass-through).
   */
  async getDataset({ name, projectId } = {}) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new OdkCentralError('getDataset requires a Dataset name', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.dataset(projectId, name),
      auth: this.auth,
      accept: 'application/json',
      timeoutMs: this.timeoutMs,
    });
    return readJson(response);
  }

  /**
   * Updates mutable Dataset metadata fields (`approvalRequired`, `ownerOnly`,
   * `accessFilter`) via the REST/admin surface.
   *
   * @param {{
   *   name: string,
   *   approvalRequired?: boolean,
   *   ownerOnly?: boolean,
   *   accessFilter?: { type: 'ownerOnly' } | { type: 'property', rules: { datasetProperty: string, actorProperty: string }[] } | null,
   *   projectId?: number | string
   * }} params
   * @returns {Promise<any>} the updated Dataset metadata (raw Central shape).
   */
  async updateDataset({ name, approvalRequired, ownerOnly, accessFilter, projectId } = {}) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new OdkCentralError('updateDataset requires a Dataset name', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }

    const patch = {};
    if (approvalRequired !== undefined) {
      if (typeof approvalRequired !== 'boolean') {
        throw new OdkCentralError('updateDataset approvalRequired must be boolean when provided', {
          code: ODK_CENTRAL_ERROR_CODES.CONFIG,
        });
      }
      patch.approvalRequired = approvalRequired;
    }
    if (ownerOnly !== undefined) {
      if (typeof ownerOnly !== 'boolean') {
        throw new OdkCentralError('updateDataset ownerOnly must be boolean when provided', {
          code: ODK_CENTRAL_ERROR_CODES.CONFIG,
        });
      }
      patch.ownerOnly = ownerOnly;
    }
    if (accessFilter !== undefined) {
      const validObject = accessFilter != null && typeof accessFilter === 'object' && !Array.isArray(accessFilter);
      if (!(accessFilter === null || validObject)) {
        throw new OdkCentralError('updateDataset accessFilter must be an object or null when provided', {
          code: ODK_CENTRAL_ERROR_CODES.CONFIG,
        });
      }
      patch.accessFilter = accessFilter;
    }
    if (Object.keys(patch).length === 0) {
      throw new OdkCentralError(
        'updateDataset requires at least one mutable field (approvalRequired, ownerOnly, accessFilter)',
        { code: ODK_CENTRAL_ERROR_CODES.CONFIG }
      );
    }

    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'PATCH',
      url: this.endpoints.dataset(projectId, name),
      auth: this.auth,
      headers: { 'Content-Type': 'application/json' },
      accept: 'application/json',
      body: JSON.stringify(patch),
      timeoutMs: this.timeoutMs,
    });
    return readJson(response);
  }

  /**
   * Lists a Dataset's Entities as **metadata** (`uuid` + `currentVersion`
   * label/version/conflict fields). This deliberately mirrors Central: the list
   * entries do **not** carry each Entity's property `data`. To read one Entity's
   * `data` use {@link OdkCentralClient.getEntity}; for bulk tabular property data
   * use {@link OdkCentralClient.downloadDatasetEntitiesCsv} rather than fanning
   * out one `getEntity` call per row.
   *
   * @param {{ name: string, projectId?: number | string }} params
   * @returns {Promise<any[]>} the raw Central Entity metadata list (pass-through).
   */
  async listEntities({ name, projectId } = {}) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new OdkCentralError('listEntities requires a Dataset name', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.entities(projectId, name),
      auth: this.auth,
      accept: 'application/json',
      timeoutMs: this.timeoutMs,
    });
    const body = await readJson(response);
    return Array.isArray(body) ? body : [];
  }

  /**
   * Gets one Entity, including its `currentVersion.data` property values and
   * version/conflict metadata (`version`, `baseVersion`, `conflictingProperties`,
   * `branchId`, `trunkVersion`, `branchBaseVersion`). Property values are
   * returned exactly as Central sends them (strings); the client does not coerce
   * types or invent a model.
   *
   * @param {{ name: string, uuid: string, projectId?: number | string }} params
   * @returns {Promise<any>} the raw Central Entity detail (pass-through).
   */
  async getEntity({ name, uuid, projectId } = {}) {
    if (typeof name !== 'string' || name.length === 0 || typeof uuid !== 'string' || uuid.length === 0) {
      throw new OdkCentralError('getEntity requires a Dataset name and Entity uuid', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    await this.ensureAuth();
    const response = await request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.entity(projectId, name, uuid),
      auth: this.auth,
      accept: 'application/json',
      timeoutMs: this.timeoutMs,
    });
    return readJson(response);
  }

  /**
   * Updates one Entity's label/properties via Central REST `PATCH`.
   *
   * Central concurrency is preserved by requiring an explicit `baseVersion`
   * (or an explicit `force: true`, never implied). When a stale `baseVersion`
   * is rejected, this method surfaces a dedicated non-retryable code.
   *
   * @param {{
   *   name: string,
   *   uuid: string,
   *   data?: Record<string, string>,
   *   label?: string,
   *   baseVersion?: number,
   *   force?: boolean,
   *   resolve?: boolean,
   *   projectId?: number | string
   * }} params
   * @returns {Promise<any>} updated Entity detail (raw Central shape).
   */
  async updateEntity({ name, uuid, data, label, baseVersion, force = false, resolve = false, projectId } = {}) {
    if (typeof name !== 'string' || name.length === 0 || typeof uuid !== 'string' || uuid.length === 0) {
      throw new OdkCentralError('updateEntity requires a Dataset name and Entity uuid', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    if (label !== undefined && (typeof label !== 'string' || label.length === 0)) {
      throw new OdkCentralError('updateEntity label must be a non-empty string when provided', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    if (data !== undefined && (data == null || typeof data !== 'object' || Array.isArray(data))) {
      throw new OdkCentralError('updateEntity data must be an object when provided', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    if (baseVersion !== undefined && !Number.isInteger(baseVersion)) {
      throw new OdkCentralError('updateEntity baseVersion must be an integer when provided', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    if (typeof force !== 'boolean') {
      throw new OdkCentralError('updateEntity force must be boolean when provided', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    if (typeof resolve !== 'boolean') {
      throw new OdkCentralError('updateEntity resolve must be boolean when provided', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    if (baseVersion === undefined && force !== true) {
      throw new OdkCentralError('updateEntity requires baseVersion unless force=true is explicitly set', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    if (label === undefined && data === undefined && resolve !== true) {
      throw new OdkCentralError('updateEntity requires label or data unless resolve=true', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }

    const body = {};
    if (label !== undefined) body.label = label;
    if (data !== undefined) body.data = data;
    const query = new URLSearchParams();
    if (baseVersion !== undefined) query.set('baseVersion', `${baseVersion}`);
    if (force) query.set('force', 'true');
    if (resolve) query.set('resolve', 'true');

    await this.ensureAuth();
    const url = `${this.endpoints.entity(projectId, name, uuid)}${query.size > 0 ? `?${query.toString()}` : ''}`;
    let response;
    try {
      response = await request({
        fetchImpl: this.fetchImpl,
        method: 'PATCH',
        url,
        auth: this.auth,
        headers: { 'Content-Type': 'application/json' },
        accept: 'application/json',
        body: JSON.stringify(body),
        timeoutMs: this.timeoutMs,
      });
    } catch (error) {
      if (
        error instanceof OdkCentralError &&
        (error.httpStatus === 409 || error.httpStatus === 412) &&
        baseVersion !== undefined &&
        force !== true
      ) {
        throw new OdkCentralError(error.message, {
          code: ODK_CENTRAL_ERROR_CODES.STALE_ENTITY_BASE_VERSION,
          httpStatus: error.httpStatus,
          retryable: false,
          details: error.details,
          cause: error,
        });
      }
      throw error;
    }
    return readJson(response);
  }

  /**
   * Downloads a Dataset's Entities as the **REST/admin** OData-flavored CSV
   * (`__id,label,…,__createdAt,__version`). Returns the raw `Response` so the
   * host app decides how to consume the bytes; the client does not parse it.
   *
   * Note this is **not** the field-client Entity-List CSV (`name,label,__version,…`)
   * that the stock XForms engine consumes — that one is a form attachment
   * discovered via the OpenRosa manifest and fetched with
   * {@link OdkCentralClient.downloadFormAttachment}. The two CSVs have different
   * shapes and authorization paths and are not interchangeable.
   *
   * @param {{ name: string, projectId?: number | string }} params
   * @returns {Promise<Response>}
   */
  async downloadDatasetEntitiesCsv({ name, projectId } = {}) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new OdkCentralError('downloadDatasetEntitiesCsv requires a Dataset name', {
        code: ODK_CENTRAL_ERROR_CODES.CONFIG,
      });
    }
    await this.ensureAuth();
    return request({
      fetchImpl: this.fetchImpl,
      method: 'GET',
      url: this.endpoints.datasetEntitiesCsv(projectId, name),
      auth: this.auth,
      accept: 'text/csv',
      timeoutMs: this.timeoutMs,
    });
  }
}
