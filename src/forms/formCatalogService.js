import { OdkCentralClient, createAppUserAuth } from 'odk-central-client';
import { digestBytes } from 'gather-hashing';

import { sweepResourceBlobs } from './resourceBlobCleanup.js';
import { GatherPaths } from 'gather-storage/paths';
import {
  formKeyFor,
  formVersionKeyFor,
  manifestFingerprintFor,
} from 'gather-storage/repositories/forms';

export class FormCatalogError extends Error {
  constructor(message, { code = 'GATHER_FORM_CATALOG_ERROR', details = null } = {}) {
    super(message);
    this.name = 'FormCatalogError';
    this.code = code;
    this.details = details;
  }
}

const nonEmpty = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new FormCatalogError(`${field} must be a non-empty string`, {
      code: 'GATHER_FORM_CATALOG_INVALID',
      details: { field },
    });
  }
  return value;
};

const stringOrEmpty = (value) => (typeof value === 'string' ? value : '');

/**
 * The OpenRosa Entity List integrity URL identifies its Central Dataset. Read it
 * only while sanitizing the manifest; persist the dataset name, never the URL
 * (which can carry an App User key).
 */
export const entityDatasetFromIntegrityUrl = (integrityUrl) => {
  if (typeof integrityUrl !== 'string' || integrityUrl.length === 0) return null;
  try {
    const segments = new URL(integrityUrl).pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const datasetIndex = segments.lastIndexOf('datasets');
    const dataset = segments[datasetIndex + 1];
    return datasetIndex >= 0 && segments[datasetIndex + 2] === 'integrity' && dataset ? dataset : null;
  } catch {
    return null;
  }
};

/**
 * Keep only non-secret manifest metadata. OpenRosa download/integrity URLs may
 * carry the App User key, and are never persisted or passed to the renderer.
 */
export const sanitizeManifest = (manifest) => {
  const seen = new Set();
  return (Array.isArray(manifest) ? manifest : []).map((entry) => {
    const filename = nonEmpty(entry?.filename, 'manifest filename');
    if (seen.has(filename)) {
      throw new FormCatalogError(`manifest repeats resource "${filename}"`, {
        code: 'GATHER_FORM_CATALOG_MANIFEST_INVALID',
      });
    }
    seen.add(filename);
    return {
      filename,
      hash: stringOrEmpty(entry?.hash),
      type: typeof entry?.type === 'string' ? entry.type : null,
      isEntityList: Boolean(entry?.isEntityList),
      entityDataset: Boolean(entry?.isEntityList)
        ? entityDatasetFromIntegrityUrl(entry?.integrityUrl)
        : null,
    };
  });
};

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * A short, deterministic path segment whose source identity remains in SQLite.
 * Paths never contain Central form IDs, filenames, or server URLs directly.
 */
export const cacheSegment = (value) => {
  const source = String(value);
  let first = FNV_OFFSET;
  let second = FNV_OFFSET ^ 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first = Math.imul(first ^ code, FNV_PRIME) >>> 0;
    second = Math.imul(second ^ (code + index), FNV_PRIME) >>> 0;
  }
  return `${first.toString(36)}-${second.toString(36)}`;
};

export const contentTypeFor = (resource, response) => {
  const fromResponse = response?.headers?.get?.('content-type');
  if (typeof fromResponse === 'string' && fromResponse.length > 0) {
    return fromResponse.split(';', 1)[0].trim().toLowerCase();
  }
  return resource?.isEntityList ? 'text/csv' : 'application/octet-stream';
};

/**
 * Whether a form resource should be cached and handed back as text.
 *
 * The filename clause is not belt-and-braces: Central serves an attachment it
 * classified as `image` — which is what its scanner calls anything declared
 * through an itext media value — as `application/octet-stream`. Verified live
 * against Central v2026.2.4. Without it a composition artifact downloads
 * intact, is cached as bytes, and then reaches the composition loader with no
 * `text`, which reports it as "present but empty".
 *
 * `.gather` is deliberately absent: that bundle is opaque by design, and the
 * loader decodes it rather than the cache guessing it is text.
 */
export const isTextResource = (resource) =>
  Boolean(resource?.isEntityList) ||
  /^text\//i.test(resource?.contentType ?? '') ||
  /(?:json|xml|javascript|csv)$/i.test(resource?.contentType ?? '') ||
  /\.(?:json|xml|csv|txt)$/i.test(resource?.filename ?? '');

export const bytesToBase64 = (input) => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset];
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    encoded += alphabet[first >> 2];
    encoded += alphabet[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    encoded += second == null ? '=' : alphabet[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    encoded += third == null ? '=' : alphabet[third & 0x3f];
  }
  return encoded;
};

/**
 * Where a resource's BYTES live: under their own digest, not under the form
 * revision that happened to reference them.
 *
 * A form revision references bytes; it does not own them. Keying by revision is
 * what made one changed resource re-store every sibling — see
 * docs/reference/architecture/form-refresh-cost.md.
 */
export const blobKeyFor = ({ projectKey, digest }) =>
  GatherPaths.resources(projectKey, 'blobs', digest.replace(':', '-'));

const cacheKeysFor = ({ projectKey, formId, sourceVersion, sourceHash, fingerprint }) => {
  const formSegment = `form-${cacheSegment(formId)}`;
  const revisionSegment = `revision-${cacheSegment(
    JSON.stringify([sourceVersion, sourceHash, fingerprint])
  )}`;
  return {
    xmlFileKey: GatherPaths.forms(projectKey, formSegment, revisionSegment, 'form.xml'),
    manifestFileKey: GatherPaths.forms(projectKey, formSegment, revisionSegment, 'manifest.json'),
  };
};

const defaultCreateClient = ({ baseUrl, centralProjectId, token }) =>
  new OdkCentralClient({
    baseUrl,
    projectId: centralProjectId,
    auth: createAppUserAuth(token),
    timeoutMs: 45_000,
  });

const assertDependencies = ({ forms, credentials, files, createClient }) => {
  if (
    !forms ||
    typeof forms.listForms !== 'function' ||
    typeof forms.getVersion !== 'function' ||
    typeof forms.getCurrentVersion !== 'function' ||
    typeof forms.findVersion !== 'function' ||
    typeof forms.recordCachedVersion !== 'function' ||
    typeof forms.promoteVersion !== 'function' ||
    // The content-addressed resource cache. Required rather than optional:
    // silently falling back to per-version storage would reintroduce the
    // duplication these exist to remove, and nothing would say so.
    typeof forms.findResourceByValidator !== 'function' ||
    typeof forms.getResourceBlob !== 'function' ||
    typeof forms.recordResourceBlob !== 'function' ||
    !credentials ||
    typeof credentials.getProjectToken !== 'function' ||
    !files ||
    typeof files.writeTextAtomic !== 'function' ||
    typeof files.writeBytesAtomic !== 'function' ||
    typeof files.readText !== 'function' ||
    typeof files.readBytes !== 'function' ||
    typeof files.fileForKey !== 'function' ||
    typeof createClient !== 'function'
  ) {
    throw new FormCatalogError('Form catalog is not available yet.', {
      code: 'GATHER_FORM_CATALOG_UNAVAILABLE',
    });
  }
};

const assertProject = (project) => {
  const projectKey = nonEmpty(project?.projectKey, 'projectKey');
  const baseUrl = nonEmpty(project?.baseUrl, 'baseUrl');
  const centralProjectId = Number(project?.centralProjectId);
  if (!Number.isSafeInteger(centralProjectId) || centralProjectId < 1) {
    throw new FormCatalogError('project centralProjectId must be a positive integer', {
      code: 'GATHER_FORM_CATALOG_INVALID',
    });
  }
  return { projectKey, baseUrl, centralProjectId };
};

const listingDetails = (listing) => ({
  formId: nonEmpty(listing?.formId, 'formId'),
  displayName:
    typeof listing?.name === 'string' && listing.name.trim().length > 0
      ? listing.name
      : nonEmpty(listing?.formId, 'formId'),
  sourceVersion: stringOrEmpty(listing?.version),
  sourceHash: stringOrEmpty(listing?.hash),
});

/**
 * Composition-root service for one explicit catalog refresh and cached loads.
 * It calls only public App User/OpenRosa methods; attachment URLs are neither
 * assembled nor consumed by the app.
 */
export const createFormCatalogService = ({
  forms,
  credentials,
  files,
  entities,
  createClient = defaultCreateClient,
} = {}) => {
  assertDependencies({ forms, credentials, files, createClient });

  const clientFor = async (project) => {
    const token = await credentials.getProjectToken(project.projectKey);
    if (typeof token !== 'string' || token.length === 0) {
      throw new FormCatalogError('The active project has no App User token.', {
        code: 'GATHER_FORM_CATALOG_CREDENTIALS_MISSING',
      });
    }
    const client = createClient({ ...project, token });
    const methods = ['listForms', 'downloadForm', 'getFormManifest', 'downloadFormAttachment'];
    if (!client || methods.some((method) => typeof client[method] !== 'function')) {
      throw new FormCatalogError('Could not prepare the Central form client.', {
        code: 'GATHER_FORM_CATALOG_CLIENT_INVALID',
      });
    }
    return client;
  };

  const loadVersion = async (version) => {
    if (!version) {
      throw new FormCatalogError('This form version is not available offline.', {
        code: 'GATHER_FORM_CATALOG_NOT_CACHED',
      });
    }
    const attachments = await Promise.all(
      version.resources.map(async (resource) => {
        if (isTextResource(resource)) {
          return {
            filename: resource.filename,
            contentType: resource.contentType,
            text: await files.readText(resource.fileKey),
          };
        }
        return {
          filename: resource.filename,
          contentType: resource.contentType,
          base64: bytesToBase64(await files.readBytes(resource.fileKey)),
        };
      })
    );
    return {
      version,
      xml: await files.readText(version.xmlFileKey),
      attachments: entities
        ? await entities.synthesizeAttachments({
            projectKey: version.projectKey,
            resources: version.resources,
            attachments,
          })
        : attachments,
    };
  };

  return {
    listCachedForms(projectKey) {
      return forms.listForms(projectKey);
    },

    /**
     * Refresh only when a user explicitly requests it. Every identity contains
     * the sanitized manifest fingerprint, so a changed Entity List becomes a
     * new immutable cache version rather than mutating a draft's old resources.
     */
    async refresh(projectInput) {
      const project = assertProject(projectInput);
      let client;
      let listings;
      try {
        client = await clientFor(project);
        listings = await client.listForms();
      } catch {
        throw new FormCatalogError('Could not refresh forms from Central.', {
          code: 'GATHER_FORM_CATALOG_REFRESH_FAILED',
        });
      }

      const refreshed = [];
      const failures = [];
      for (const listing of Array.isArray(listings) ? listings : []) {
        let details;
        try {
          details = listingDetails(listing);
          const manifest = sanitizeManifest(
            await client.getFormManifest({ formId: details.formId })
          );
          const fingerprint = manifestFingerprintFor(manifest);
          const formKey = formKeyFor({ projectKey: project.projectKey, formId: details.formId });
          const formVersionId = formVersionKeyFor({
            formKey,
            sourceVersion: details.sourceVersion,
            sourceHash: details.sourceHash,
            manifestFingerprint: fingerprint,
          });
          const existing = await forms.findVersion({
            formKey,
            sourceVersion: details.sourceVersion,
            sourceHash: details.sourceHash,
            manifestFingerprint: fingerprint,
          });

          if (existing) {
            await forms.promoteVersion({ ...project, ...details, formVersionId });
            refreshed.push({ formId: details.formId, formVersionId, cached: true });
            continue;
          }

          const keys = cacheKeysFor({
            projectKey: project.projectKey,
            formId: details.formId,
            sourceVersion: details.sourceVersion,
            sourceHash: details.sourceHash,
            fingerprint,
          });
          const xml = await client.downloadForm({ formId: details.formId });
          await files.writeTextAtomic(keys.xmlFileKey, xml);
          await files.writeTextAtomic(
            keys.manifestFileKey,
            JSON.stringify({ formId: details.formId, resources: manifest })
          );

          // Two different questions, and they need two different answers.
          //
          //   the server's validator  →  must I fetch this again?
          //   our digest of the bytes →  do I already hold these?
          //
          // The second cannot be derived from the first: Central computes a
          // Dataset attachment's hash from the dataset's last-updated
          // timestamp, so an Entity List's validator changes when its bytes do
          // not. That forces a download the digest then proves was redundant —
          // and we still decline to write a second copy.
          const resources = [];
          for (const resource of manifest) {
            const known = await forms.findResourceByValidator({
              projectKey: project.projectKey,
              formId: details.formId,
              filename: resource.filename,
              resourceHash: resource.hash,
            });
            if (known?.blobDigest && (await files.fileForKey(known.fileKey))?.exists) {
              // The server says nothing changed and we still have the bytes.
              resources.push({
                ...resource,
                contentType: known.contentType,
                fileKey: known.fileKey,
                blobDigest: known.blobDigest,
              });
              continue;
            }

            const response = await client.downloadFormAttachment({
              formId: details.formId,
              filename: resource.filename,
            });
            const contentType = contentTypeFor(resource, response);
            const bytes = new Uint8Array(await response.arrayBuffer());
            const blobDigest = digestBytes(bytes);

            const blob = await forms.getResourceBlob(blobDigest);
            let fileKey = blob?.fileKey ?? null;
            if (!fileKey || !(await files.fileForKey(fileKey))?.exists) {
              fileKey = blobKeyFor({ projectKey: project.projectKey, digest: blobDigest });
              await files.writeBytesAtomic(fileKey, bytes);
              await forms.recordResourceBlob({
                digest: blobDigest,
                byteLength: bytes.byteLength,
                fileKey,
              });
            }
            resources.push({ ...resource, contentType, fileKey, blobDigest });
          }

          await forms.recordCachedVersion({
            projectKey: project.projectKey,
            ...details,
            manifestFingerprint: fingerprint,
            ...keys,
            resources,
          });
          refreshed.push({ formId: details.formId, formVersionId, cached: false });
        } catch {
          // Do not leak a request URL (which may embed an App User key) to UI/logs.
          failures.push({ formId: details?.formId ?? 'unknown', message: 'Could not cache this form.' });
        }
      }
      // A refresh is the moment the reachable set changes, so it is the natural
      // sweep boundary. Best-effort and its outcome unreported: an uncollected
      // blob costs disk, and failing a refresh over it would cost the fieldwork.
      const swept = await sweepResourceBlobs({
        projectKey: project.projectKey,
        forms,
        files,
        blobDirectoryKey: GatherPaths.resources(project.projectKey, 'blobs'),
      }).catch(() => null);

      return { refreshed, failures, swept: swept?.deleted?.length ?? 0 };
    },

    /** Read any exact immutable version and turn resources into public host descriptors. */
    async loadFormVersion(formVersionId) {
      return loadVersion(await forms.getVersion(nonEmpty(formVersionId, 'formVersionId')));
    },

    /** Read the current cached immutable version and turn resources into host descriptors. */
    async loadCurrentForm(projectKey, formId) {
      const version = await forms.getCurrentVersion(projectKey, formId);
      if (!version) {
        throw new FormCatalogError('This form has not been downloaded. Refresh Forms first.', {
          code: 'GATHER_FORM_CATALOG_NOT_CACHED',
        });
      }
      return loadVersion(version);
    },
  };
};
