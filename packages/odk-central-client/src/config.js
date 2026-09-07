import { OdkCentralError, ODK_CENTRAL_ERROR_CODES } from './errors.js';

/**
 * @typedef {import('./auth.js').OdkCentralAuth} OdkCentralAuth
 */

/**
 * @typedef {{
 *   baseUrl: string,
 *   projectId: number | string | null,
 *   auth: OdkCentralAuth | null
 * }} NormalizedCentralConfig
 */

const configError = (message) =>
  new OdkCentralError(message, { code: ODK_CENTRAL_ERROR_CODES.CONFIG });

/**
 * Normalizes user-supplied client configuration.
 *
 * - `baseUrl` must be an absolute http(s) URL; any trailing slash is removed so
 *   endpoint builders can concatenate paths unambiguously.
 * - `projectId` is optional at construction and may be supplied per call.
 *
 * @param {{ baseUrl?: string, projectId?: number | string, auth?: OdkCentralAuth }} [config]
 * @returns {NormalizedCentralConfig}
 */
export const normalizeConfig = (config = {}) => {
  const { baseUrl, projectId = null, auth = null } = config;
  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    throw configError('OdkCentralClient requires a non-empty baseUrl');
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw configError(`OdkCentralClient baseUrl must be an http(s) URL, got: ${baseUrl}`);
  }
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  return {
    baseUrl: normalizedBaseUrl,
    projectId,
    auth,
  };
};

/**
 * @param {NormalizedCentralConfig} config
 * @param {number | string | null | undefined} override
 * @returns {string}
 */
const resolveProjectId = (config, override) => {
  const projectId = override ?? config.projectId;
  if (projectId == null || `${projectId}`.length === 0) {
    throw configError('A projectId is required (pass one to the call or the constructor)');
  }
  return encodeURIComponent(`${projectId}`);
};

const enc = (value) => encodeURIComponent(`${value}`);

/**
 * Builds Central REST and OpenRosa endpoint URLs for a given config.
 *
 * Endpoints follow ODK Central's documented routes; see the package README for
 * the reference links. Only the routes needed by the M4 vertical slice are
 * modelled here — extend as real workflows require it.
 *
 * @param {NormalizedCentralConfig} config
 */
export const createEndpoints = (config) => {
  const v1 = `${config.baseUrl}/v1`;
  return {
    /** `GET {baseUrl}/version.txt` — Central deployment version file (best-effort, served at the site root, not under `/v1`). */
    serverVersion: () => `${config.baseUrl}/version.txt`,
    /** `POST /v1/sessions` — web-user session auth. */
    sessions: () => `${v1}/sessions`,
    /** `GET /v1/projects` */
    projects: () => `${v1}/projects`,
    /** OpenRosa `GET /v1/projects/:id/formList` */
    formList: (projectId) => `${v1}/projects/${resolveProjectId(config, projectId)}/formList`,
    /** REST `GET /v1/projects/:id/forms/:xmlFormId.xml` — the XForm definition. */
    formXml: (projectId, xmlFormId) =>
      `${v1}/projects/${resolveProjectId(config, projectId)}/forms/${enc(xmlFormId)}.xml`,
    /** OpenRosa `GET /v1/projects/:id/forms/:xmlFormId/manifest` — field-client resource discovery (App User). */
    formManifest: (projectId, xmlFormId) =>
      `${v1}/projects/${resolveProjectId(config, projectId)}/forms/${enc(xmlFormId)}/manifest`,
    /** REST `GET /v1/projects/:id/forms/:xmlFormId/attachments` */
    formAttachments: (projectId, xmlFormId) =>
      `${v1}/projects/${resolveProjectId(config, projectId)}/forms/${enc(xmlFormId)}/attachments`,
    /** REST `GET /v1/projects/:id/forms/:xmlFormId/attachments/:filename` */
    formAttachment: (projectId, xmlFormId, filename) =>
      `${v1}/projects/${resolveProjectId(config, projectId)}/forms/${enc(xmlFormId)}/attachments/${enc(filename)}`,
    /** OpenRosa `POST /v1/projects/:id/submission` */
    submission: (projectId) => `${v1}/projects/${resolveProjectId(config, projectId)}/submission`,
    /**
     * REST `GET|POST /v1/projects/:id/actor-properties` — project-scoped Actor
     * Property name registration/listing (used by Dataset property accessFilter).
     */
    actorProperties: (projectId) => `${v1}/projects/${resolveProjectId(config, projectId)}/actor-properties`,
    /**
     * REST `GET /v1/projects/:id/datasets` — Entity Lists (called *Datasets* in
     * the Central developer API, *Entity Lists* in the Central UI). Web User /
     * admin surface; App Users receive `403`.
     */
    datasets: (projectId) => `${v1}/projects/${resolveProjectId(config, projectId)}/datasets`,
    /** REST `GET /v1/projects/:id/datasets/:name` — Dataset detail (property schema, linked/source forms). */
    dataset: (projectId, name) =>
      `${v1}/projects/${resolveProjectId(config, projectId)}/datasets/${enc(name)}`,
    /**
     * REST `GET /v1/projects/:id/datasets/:name/entities` — Entity **metadata**
     * list (uuid + `currentVersion` label/version/conflict fields). This is *not*
     * a bulk property-data API: the list entries omit `data`; use
     * {@link createEndpoints.entity} for a single Entity's `data`, or
     * {@link createEndpoints.datasetEntitiesCsv} for bulk tabular data.
     */
    entities: (projectId, name) =>
      `${v1}/projects/${resolveProjectId(config, projectId)}/datasets/${enc(name)}/entities`,
    /** REST `GET /v1/projects/:id/datasets/:name/entities/:uuid` — single Entity, including `currentVersion.data`. */
    entity: (projectId, name, uuid) =>
      `${v1}/projects/${resolveProjectId(config, projectId)}/datasets/${enc(name)}/entities/${enc(uuid)}`,
    /**
     * REST `GET /v1/projects/:id/datasets/:name/entities.csv` — bulk Entity data
     * as an OData-flavored CSV (`__id,label,…,__createdAt,__version`). This is
     * the **admin/REST** export and differs from the field-client Entity-List
     * CSV delivered as a form attachment (`name,label,__version,…`), which is
     * discovered via the OpenRosa manifest and fetched with
     * `downloadFormAttachment`.
     */
    datasetEntitiesCsv: (projectId, name) =>
      `${v1}/projects/${resolveProjectId(config, projectId)}/datasets/${enc(name)}/entities.csv`,
  };
};

export { resolveProjectId };
