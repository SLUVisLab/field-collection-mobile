import { OdkCentralClient, createAppUserAuth, extractInstanceId } from 'odk-central-client';
import { GatherPaths } from 'gather-storage/paths';
import { sanitizeErrorText } from 'gather-storage/sanitize';

export const INSTANCE_LIFECYCLE_ERROR_CODES = Object.freeze({
  UNAVAILABLE: 'GATHER_INSTANCE_UNAVAILABLE',
  INVALID: 'GATHER_INSTANCE_INVALID',
  NOT_FOUND: 'GATHER_INSTANCE_NOT_FOUND',
  INVALID_STATE: 'GATHER_INSTANCE_INVALID_STATE',
  VALIDATION: 'GATHER_INSTANCE_VALIDATION',
  SERIALIZATION: 'GATHER_INSTANCE_SERIALIZATION',
  CREDENTIALS: 'GATHER_INSTANCE_CREDENTIALS',
  MEDIA: 'GATHER_INSTANCE_MEDIA',
  ENTITY_EFFECTS: 'GATHER_INSTANCE_ENTITY_EFFECTS',
});

export class InstanceLifecycleError extends Error {
  constructor(message, { code = INSTANCE_LIFECYCLE_ERROR_CODES.INVALID, details = null } = {}) {
    super(message);
    this.name = 'InstanceLifecycleError';
    this.code = code;
    this.details = details;
  }
}

const fail = (message, code, details = null) => {
  throw new InstanceLifecycleError(message, { code, details });
};

const nonEmpty = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${field} must be a non-empty string`, INSTANCE_LIFECYCLE_ERROR_CODES.INVALID, { field });
  }
  return value;
};

const stringOrEmpty = (value) => (typeof value === 'string' ? value : '');

const defaultNewLocalInstanceId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid === 'string') {
    return `i-${uuid.replace(/[^A-Za-z0-9_-]/g, '')}`;
  }
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const instanceXmlKeyFor = ({ projectKey, localInstanceId }) =>
  GatherPaths.instances(projectKey, localInstanceId, 'instance.xml');

const IMAGE_EXTENSIONS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});


const assertImageContentType = (contentType) => {
  if (typeof contentType !== 'string' || !Object.hasOwn(IMAGE_EXTENSIONS, contentType)) {
    fail(
      'This form can only attach JPEG, PNG, or WebP images.',
      INSTANCE_LIFECYCLE_ERROR_CODES.MEDIA
    );
  }
  return contentType;
};

const assertBindingReference = (reference) => {
  if (typeof reference !== 'string' || reference.length === 0 || reference.length > 1_000) {
    fail('Image binding reference is invalid.', INSTANCE_LIFECYCLE_ERROR_CODES.MEDIA);
  }
  return reference;
};

/**
 * Mints an attachment filename **once, at capture**.
 *
 * Deliberately not derived from the XForms binding reference. Repeat instance
 * references are positional and reindex when an item is deleted, so a
 * reference-derived name makes a survivor inherit the deleted item's
 * attachment — a silent wrong image on the record. The filename is written into
 * the node value instead, so identity travels with the node.
 * See docs/repeat-media-identity-characterization.md.
 */
export const imageFilenameForCapture = ({ contentType, suffix = randomMediaSuffix() } = {}) =>
  `image-${nonEmpty(suffix, 'suffix')}.${IMAGE_EXTENSIONS[assertImageContentType(contentType)]}`;

export const instanceMediaKeyFor = ({ projectKey, localInstanceId, filename }) =>
  GatherPaths.media(projectKey, nonEmpty(localInstanceId, 'localInstanceId'), nonEmpty(filename, 'filename'));

const randomMediaSuffix = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const assertProject = (project) => {
  const projectKey = nonEmpty(project?.projectKey, 'projectKey');
  const baseUrl = nonEmpty(project?.baseUrl, 'baseUrl');
  const centralProjectId = Number(project?.centralProjectId);
  if (!Number.isSafeInteger(centralProjectId) || centralProjectId < 1) {
    fail(
      'project centralProjectId must be a positive integer',
      INSTANCE_LIFECYCLE_ERROR_CODES.INVALID,
      { field: 'centralProjectId' }
    );
  }
  return { projectKey, baseUrl, centralProjectId };
};

const identityForVersion = (version) => ({
  formVersionId: nonEmpty(version?.formVersionId, 'formVersionId'),
  projectKey: nonEmpty(version?.projectKey, 'version projectKey'),
  formId: nonEmpty(version?.formId, 'formId'),
  formVersion: stringOrEmpty(version?.sourceVersion),
  formHash: stringOrEmpty(version?.sourceHash),
});

const assertVersionForProject = (version, project) => {
  const identity = identityForVersion(version);
  if (identity.projectKey !== project.projectKey) {
    fail('Form version does not belong to the active project', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID);
  }
  return identity;
};

const serializeFrom = async (form) => {
  if (!form || typeof form.serialize !== 'function') {
    fail('The form engine is not ready to save.', INSTANCE_LIFECYCLE_ERROR_CODES.UNAVAILABLE);
  }
  const serialized = await form.serialize();
  if (typeof serialized?.xml !== 'string' || serialized.xml.trim().length === 0) {
    fail('The form engine did not produce submission XML.', INSTANCE_LIFECYCLE_ERROR_CODES.SERIALIZATION);
  }
  const odkInstanceId = extractInstanceId(serialized.xml);
  if (typeof odkInstanceId !== 'string' || odkInstanceId.length === 0) {
    fail('The form XML has no ODK instance ID.', INSTANCE_LIFECYCLE_ERROR_CODES.SERIALIZATION);
  }
  return { ...serialized, odkInstanceId };
};

/**
 * Store only a bounded, credential-free response/error summary. In particular,
 * OpenRosa App User keys, bearer credentials, and common token query/field
 * shapes cannot reach the SQLite metadata or user-visible retry message.
 */
export const sanitizeSubmissionText = (value, fallback = 'Submission failed. Try again.') =>
  sanitizeErrorText(value, fallback);

const receiptFor = (result, odkInstanceId) =>
  sanitizeSubmissionText(
    JSON.stringify({
      status: Number.isFinite(Number(result?.status)) ? Number(result.status) : null,
      message: typeof result?.message === 'string' ? result.message : null,
      instanceId: typeof result?.instanceId === 'string' ? result.instanceId : odkInstanceId,
    }),
    '{"status":null}'
  );

const defaultCreateClient = ({ baseUrl, centralProjectId, token }) =>
  new OdkCentralClient({
    baseUrl,
    projectId: centralProjectId,
    auth: createAppUserAuth(token),
    timeoutMs: 45_000,
  });

const assertDependencies = ({
  instances,
  formCatalog,
  entityEffects,
  credentials,
  files,
  createClient,
  newLocalInstanceId,
}) => {
  if (
    !instances ||
    typeof instances.get !== 'function' ||
    typeof instances.list !== 'function' ||
    typeof instances.createDraft !== 'function' ||
    typeof instances.saveDraft !== 'function' ||
    typeof instances.markReady !== 'function' ||
    typeof instances.markSendFailure !== 'function' ||
    typeof instances.markSent !== 'function' ||
    typeof instances.removeDraft !== 'function' ||
    !formCatalog ||
    typeof formCatalog.loadFormVersion !== 'function' ||
    !credentials ||
    typeof credentials.getProjectToken !== 'function' ||
    !files ||
    typeof files.writeTextAtomic !== 'function' ||
    typeof files.readText !== 'function' ||
    typeof files.deleteFile !== 'function' ||
    typeof createClient !== 'function' ||
    typeof newLocalInstanceId !== 'function'
  ) {
    fail('Instance lifecycle is not available yet.', INSTANCE_LIFECYCLE_ERROR_CODES.UNAVAILABLE);
  }
};

/**
 * Compose XML persistence, immutable form-version loading, and foreground
 * Central submission. The repository has no answer columns: XML is the sole
 * persisted form state.
 */
export const createInstanceLifecycleService = ({
  instances,
  formCatalog,
  entityEffects,
  credentials,
  files,
  createClient = defaultCreateClient,
  newLocalInstanceId = defaultNewLocalInstanceId,
} = {}) => {
  assertDependencies({
    instances,
    formCatalog,
    entityEffects,
    credentials,
    files,
    createClient,
    newLocalInstanceId,
  });

  const owned = async (localInstanceId, project) => {
    const instance = await instances.get(localInstanceId);
    if (!instance) {
      fail('This saved instance no longer exists.', INSTANCE_LIFECYCLE_ERROR_CODES.NOT_FOUND);
    }
    if (instance.projectKey !== project.projectKey) {
      fail('This instance belongs to another project.', INSTANCE_LIFECYCLE_ERROR_CODES.NOT_FOUND);
    }
    return instance;
  };

  const writeAndCreateDraft = async ({ project, version, serialized, localInstanceId = null }) => {
    const id = localInstanceId == null ? nonEmpty(newLocalInstanceId(), 'localInstanceId') : nonEmpty(localInstanceId, 'localInstanceId');
    const xmlFileKey = instanceXmlKeyFor({ projectKey: project.projectKey, localInstanceId: id });
    await files.writeTextAtomic(xmlFileKey, serialized.xml);
    try {
      return await instances.createDraft({
        localInstanceId: id,
        odkInstanceId: serialized.odkInstanceId,
        projectKey: project.projectKey,
        formId: version.formId,
        formVersionId: version.formVersionId,
        formVersion: version.formVersion,
        formHash: version.formHash,
        xmlFileKey,
      });
    } catch (error) {
      // A failed metadata insert must never make a partial/invalid XML visible.
      try {
        await files.deleteFile(xmlFileKey);
      } catch {
        // The XML is unreachable without metadata; avoid masking the DB failure.
      }
      throw error;
    }
  };

  const saveSerializedDraft = async ({ project, form, version, localInstanceId = null }) => {
    const serialized = await serializeFrom(form);
    if (localInstanceId == null) {
      return writeAndCreateDraft({ project, version, serialized });
    }
    const instance = await owned(localInstanceId, project);
    if (instance.state !== 'draft') {
      fail('Only drafts can be saved for editing.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID_STATE);
    }
    if (instance.formVersionId !== version.formVersionId) {
      fail('A draft must keep its original form version.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID);
    }
    await files.writeTextAtomic(instance.xmlFileKey, serialized.xml);
    return instances.saveDraft({ localInstanceId: instance.localInstanceId, odkInstanceId: serialized.odkInstanceId });
  };

  const clientFor = async (project) => {
    const token = await credentials.getProjectToken(project.projectKey);
    if (typeof token !== 'string' || token.length === 0) {
      fail('The active project has no App User token.', INSTANCE_LIFECYCLE_ERROR_CODES.CREDENTIALS);
    }
    const client = createClient({ ...project, token });
    if (!client || typeof client.submit !== 'function') {
      fail('Could not prepare the Central submission client.', INSTANCE_LIFECYCLE_ERROR_CODES.UNAVAILABLE);
    }
    return client;
  };

  const listInstanceMedia = async (localInstanceId) => {
    if (typeof instances.listMedia !== 'function') {
      return [];
    }
    const media = await instances.listMedia(localInstanceId);
    return Array.isArray(media) ? media : [];
  };

  const assertMediaDependencies = () => {
    if (
      typeof instances.upsertMedia !== 'function' ||
      typeof instances.listMedia !== 'function' ||
      typeof files.writeBytesAtomic !== 'function' ||
      typeof files.fileForKey !== 'function'
    ) {
      fail('Image attachment storage is not available yet.', INSTANCE_LIFECYCLE_ERROR_CODES.UNAVAILABLE);
    }
  };

  const send = async ({ localInstanceId, project: projectInput } = {}) => {
    const project = assertProject(projectInput);
    const instance = await owned(nonEmpty(localInstanceId, 'localInstanceId'), project);
    if (instance.state !== 'ready') {
      fail('Only ready instances can be sent.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID_STATE);
    }
    try {
      const xml = await files.readText(instance.xmlFileKey);
      const xmlInstanceId = extractInstanceId(xml);
      if (typeof xmlInstanceId !== 'string' || xmlInstanceId.length === 0) {
        fail('Saved XML has no ODK instance ID.', INSTANCE_LIFECYCLE_ERROR_CODES.SERIALIZATION);
      }
      const media = await listInstanceMedia(instance.localInstanceId);
      const attachments = media.map((entry) => ({
        name: entry.filename,
        contentType: entry.contentType,
        // `fileForKey` is the native adapter: it returns the actual Expo
        // File/Blob body. The Central client passes it straight to FormData.
        data: files.fileForKey(entry.fileKey),
      }));
      const result = await (await clientFor(project)).submit({ xml, attachments });
      return {
        ok: true,
        instance: await instances.markSent({
          localInstanceId: instance.localInstanceId,
          sendReceipt: receiptFor(result, xmlInstanceId),
        }),
      };
    } catch (error) {
      // Network/server/auth failures are intentionally not queued or retried in
      // the background. The ready state remains visible for a user-triggered retry.
      const sendError = sanitizeSubmissionText(error);
      return {
        ok: false,
        instance: await instances.markSendFailure({
          localInstanceId: instance.localInstanceId,
          sendError,
        }),
      };
    }
  };

  return {
    list(projectInput, options) {
      const project = assertProject(projectInput);
      return instances.list(project.projectKey, options);
    },

    async resume({ localInstanceId, project: projectInput, form } = {}) {
      const project = assertProject(projectInput);
      if (!form || typeof form.loadInstance !== 'function') {
        fail('The form engine is not ready to resume.', INSTANCE_LIFECYCLE_ERROR_CODES.UNAVAILABLE);
      }
      const instance = await owned(nonEmpty(localInstanceId, 'localInstanceId'), project);
      if (instance.state !== 'draft') {
        fail('Only drafts can be resumed for editing.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID_STATE);
      }
      const cached = await formCatalog.loadFormVersion(instance.formVersionId);
      const version = assertVersionForProject(cached.version, project);
      if (
        version.formVersionId !== instance.formVersionId ||
        version.formId !== instance.formId ||
        version.formVersion !== instance.formVersion ||
        version.formHash !== instance.formHash
      ) {
        fail('Saved form version metadata does not match this draft.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID);
      }
      const xml = await files.readText(instance.xmlFileKey);
      // This public host/store method delegates to engine restoreInstance. Do not
      // replace it with app-side setValue replay; repeats/entities/metadata live
      // solely in the serialized instance XML and engine state.
      await form.loadInstance(cached.xml, xml, cached.attachments);
      return {
        instance,
        version: cached.version,
        // Resume must hand back the same version-pinned resources a fresh fill
        // gets. Without them the binding manifest and composition definitions
        // are absent on resume only, and every composition field renders as
        // unbound. See docs/composition-behaviour-audit.md.
        attachments: cached.attachments ?? [],
        media: await listInstanceMedia(instance.localInstanceId),
      };
    },

    async saveDraft({ localInstanceId = null, project: projectInput, form, version } = {}) {
      const project = assertProject(projectInput);
      const identity = assertVersionForProject(version, project);
      return saveSerializedDraft({ project, form, version: identity, localInstanceId });
    },

    /**
     * Copies a caller-supplied local image into project media, binds its
     * generated safe filename through the engine, then persists authoritative
     * XML and relative media metadata.
     */
    /**
     * Retires media a collection edit orphaned, then persists the draft.
     *
     * The engine has already removed the repeat instances, so the XML no longer
     * references these filenames. Identity is the **filename**, never a repeat
     * position — positions reindex on deletion. See
     * docs/repeat-media-identity-characterization.md.
     */
    async releaseInstanceMedia({
      localInstanceId,
      project: projectInput,
      form,
      version,
      filenames = [],
    } = {}) {
      const project = assertProject(projectInput);
      const identity = assertVersionForProject(version, project);
      assertMediaDependencies();
      if (!Array.isArray(filenames) || filenames.length === 0) {
        fail('No media was named for release.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID);
      }
      // `owned` already fails for a missing instance or another project's.
      const existing = await owned(nonEmpty(localInstanceId, 'localInstanceId'), project);
      if (existing.state !== 'draft') {
        fail('Only drafts can release media.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID_STATE);
      }
      if (existing.formVersionId !== identity.formVersionId) {
        fail('A draft must keep its original form version.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID);
      }

      const named = new Set(filenames);
      const doomed = (await listInstanceMedia(existing.localInstanceId)).filter((entry) =>
        named.has(entry.filename)
      );

      // Persist the engine's current XML first: it is authoritative, and a
      // failure here must not leave rows pointing at deleted bytes.
      const serialized = await serializeFrom(form);
      await files.writeTextAtomic(existing.xmlFileKey, serialized.xml);
      const saved = await instances.saveDraft({
        localInstanceId: existing.localInstanceId,
        odkInstanceId: serialized.odkInstanceId,
      });

      for (const entry of doomed) {
        await instances.deleteMedia({
          localInstanceId: existing.localInstanceId,
          filename: entry.filename,
        });
        await files.deleteFile(entry.fileKey);
      }
      return { instance: saved, released: doomed.map((entry) => entry.filename) };
    },

    async attachImageMedia({
      localInstanceId = null,
      project: projectInput,
      form,
      version,
      reference,
      sourceFile,
      contentType,
      previousFilename = null,
    } = {}) {
      const project = assertProject(projectInput);
      const identity = assertVersionForProject(version, project);
      assertMediaDependencies();
      const bindingReference = assertBindingReference(reference);
      const imageType = assertImageContentType(contentType);
      if (!form || typeof form.setValue !== 'function') {
        fail('The form engine is not ready to attach an image.', INSTANCE_LIFECYCLE_ERROR_CODES.UNAVAILABLE);
      }
      if (!sourceFile || typeof sourceFile.bytes !== 'function') {
        fail('The selected image is unavailable.', INSTANCE_LIFECYCLE_ERROR_CODES.MEDIA);
      }

      const existing = localInstanceId == null ? null : await owned(localInstanceId, project);
      if (existing && existing.state !== 'draft') {
        fail('Only drafts can receive an image attachment.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID_STATE);
      }
      if (existing && existing.formVersionId !== identity.formVersionId) {
        fail('A draft must keep its original form version.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID);
      }

      const id = existing?.localInstanceId ?? nonEmpty(newLocalInstanceId(), 'localInstanceId');
      const filename = imageFilenameForCapture({ contentType: imageType });
      const fileKey = instanceMediaKeyFor({
        projectKey: project.projectKey,
        localInstanceId: id,
        filename,
      });
      const priorMedia = existing && typeof previousFilename === 'string' && previousFilename.length > 0
        ? (await listInstanceMedia(id)).find((entry) => entry.filename === previousFilename) ?? null
        : null;
      let bytes;
      try {
        bytes = await sourceFile.bytes();
      } catch {
        fail('The selected image could not be read.', INSTANCE_LIFECYCLE_ERROR_CODES.MEDIA);
      }
      if (!bytes || Number(bytes.byteLength) === 0) {
        fail('The selected image is empty.', INSTANCE_LIFECYCLE_ERROR_CODES.MEDIA);
      }

      await files.writeBytesAtomic(fileKey, bytes);
      let saved = null;
      try {
        // The WebView host recognizes binary upload controls and creates its
        // ephemeral web File with this exact name. Native bytes remain in
        // Gather storage and are used only by foreground OpenRosa submission.
        await form.setValue(bindingReference, filename);
        const serialized = await serializeFrom(form);
        if (existing) {
          await files.writeTextAtomic(existing.xmlFileKey, serialized.xml);
          saved = await instances.saveDraft({
            localInstanceId: id,
            odkInstanceId: serialized.odkInstanceId,
          });
        } else {
          saved = await writeAndCreateDraft({
            project,
            version: identity,
            serialized,
            localInstanceId: id,
          });
        }
        const media = await instances.upsertMedia({
          localInstanceId: id,
          bindingReference,
          filename,
          contentType: imageType,
          fileKey,
        });
        if (priorMedia && priorMedia.filename !== filename) {
          // The new capture has its own filename, so the prior row is not
          // overwritten by the upsert above — remove it, then its bytes.
          await instances.deleteMedia({ localInstanceId: id, filename: priorMedia.filename });
          await files.deleteFile(priorMedia.fileKey);
        }
        return { instance: saved, media };
      } catch (error) {
        if (!priorMedia || priorMedia.filename !== filename) {
          try {
            await files.deleteFile(fileKey);
          } catch {
            // Preserve the original storage/engine failure.
          }
        }
        if (!existing && saved) {
          try {
            await instances.removeDraft(saved.localInstanceId);
            await files.deleteFile(saved.xmlFileKey);
          } catch {
            // Preserve the original storage/engine failure.
          }
        }
        throw error;
      }
    },

    async finalize({ localInstanceId = null, project: projectInput, form, version } = {}) {
      const project = assertProject(projectInput);
      const identity = assertVersionForProject(version, project);
      const serialized = await serializeFrom(form);
      if (!Number.isInteger(serialized.violationCount)) {
        fail('The form engine did not return validation results.', INSTANCE_LIFECYCLE_ERROR_CODES.VALIDATION);
      }
      if (serialized.violationCount > 0 || serialized.status === 'failure') {
        fail(
          'Complete the required fields and fix validation errors before marking this ready.',
          INSTANCE_LIFECYCLE_ERROR_CODES.VALIDATION,
          { violationCount: serialized.violationCount }
        );
      }

      let instance;
      if (localInstanceId == null) {
        instance = await writeAndCreateDraft({ project, version: identity, serialized });
      } else {
        instance = await owned(localInstanceId, project);
        if (instance.state !== 'draft') {
          fail('Only drafts can be finalized.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID_STATE);
        }
        if (instance.formVersionId !== identity.formVersionId) {
          fail('A draft must keep its original form version.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID);
        }
        await files.writeTextAtomic(instance.xmlFileKey, serialized.xml);
        instance = await instances.saveDraft({
          localInstanceId: instance.localInstanceId,
          odkInstanceId: serialized.odkInstanceId,
        });
      }
      if (entityEffects) {
        if (typeof entityEffects.recordFinalizedEffects !== 'function' || !form || typeof form.getEntityEffects !== 'function') {
          fail(
            'The form engine did not provide finalized Entity effects.',
            INSTANCE_LIFECYCLE_ERROR_CODES.ENTITY_EFFECTS
          );
        }
        let effects;
        try {
          effects = await form.getEntityEffects();
        } catch {
          fail(
            'The form engine could not resolve finalized Entity effects.',
            INSTANCE_LIFECYCLE_ERROR_CODES.ENTITY_EFFECTS
          );
        }
        // Serialization above has already validated and durably written this
        // finalized XML. The host's generic projection is the only Entity input;
        // no app-side XForm/XML parsing is involved.
        await entityEffects.recordFinalizedEffects({
          projectKey: project.projectKey,
          localInstanceId: instance.localInstanceId,
          effects,
        });
      }
      return instances.markReady({
        localInstanceId: instance.localInstanceId,
        odkInstanceId: serialized.odkInstanceId,
      });
    },

    async discard({ localInstanceId, project: projectInput } = {}) {
      const project = assertProject(projectInput);
      const instance = await owned(nonEmpty(localInstanceId, 'localInstanceId'), project);
      if (instance.state !== 'draft') {
        fail('Only drafts can be discarded.', INSTANCE_LIFECYCLE_ERROR_CODES.INVALID_STATE);
      }
      const media = await listInstanceMedia(instance.localInstanceId);
      // Remove metadata first: an I/O failure can leave an unreachable orphan,
      // but never a visible instance pointing at missing XML.
      await instances.removeDraft(instance.localInstanceId);
      await files.deleteFile(instance.xmlFileKey);
      for (const attachment of media) {
        await files.deleteFile(attachment.fileKey);
      }
    },

    send,

    async sendAll(projectInput) {
      const project = assertProject(projectInput);
      const ready = await instances.list(project.projectKey, { state: 'ready' });
      const results = [];
      for (const instance of ready) {
        results.push(await send({ localInstanceId: instance.localInstanceId, project }));
      }
      return results;
    },
  };
};

export { instanceXmlKeyFor };
