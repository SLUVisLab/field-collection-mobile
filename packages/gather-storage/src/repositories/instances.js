/**
 * Durable instance metadata repository. XML is intentionally absent from this
 * layer: callers atomically persist authoritative XML first, then record its
 * validated Gather-relative key here.
 */

import { assertProjectKey, assertRelativeKey } from '../paths.js';

export const INSTANCE_STATES = Object.freeze({
  DRAFT: 'draft',
  READY: 'ready',
  SENT: 'sent',
});

const STATE_SET = new Set(Object.values(INSTANCE_STATES));
const LOCAL_INSTANCE_ID_RE = /^[A-Za-z0-9_-]+$/;

export class InstancesRepositoryError extends Error {
  constructor(message, { code = 'GATHER_INSTANCES_ERROR', details = null } = {}) {
    super(message);
    this.name = 'InstancesRepositoryError';
    this.code = code;
    this.details = details;
  }
}

const fail = (message, code, details) => {
  throw new InstancesRepositoryError(message, { code, details });
};

const nonEmpty = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${field} must be a non-empty string`, 'GATHER_INSTANCES_INVALID', { field });
  }
  return value;
};

export const assertLocalInstanceId = (value) => {
  if (typeof value !== 'string' || !LOCAL_INSTANCE_ID_RE.test(value)) {
    fail('localInstanceId must use only letters, digits, "_" or "-"', 'GATHER_INSTANCES_INVALID', {
      field: 'localInstanceId',
    });
  }
  return value;
};

const safeTextOrNull = (value, field) => {
  if (value == null) return null;
  if (typeof value !== 'string') {
    fail(`${field} must be a string or null`, 'GATHER_INSTANCES_INVALID', { field });
  }
  return value;
};

const MEDIA_FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const assertMediaFilename = (filename) => {
  if (typeof filename !== 'string' || !MEDIA_FILENAME_RE.test(filename)) {
    fail(
      'media filename must start with a letter or digit and use only letters, digits, ".", "-" or "_"',
      'GATHER_INSTANCES_INVALID',
      { field: 'filename' }
    );
  }
  return filename;
};

const assertMediaContentType = (contentType) => {
  if (
    typeof contentType !== 'string' ||
    !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(contentType)
  ) {
    fail('media contentType must be a MIME type', 'GATHER_INSTANCES_INVALID', {
      field: 'contentType',
    });
  }
  return contentType;
};

const assertBindingReference = (reference) => {
  if (typeof reference !== 'string' || reference.length === 0 || reference.length > 1_000) {
    fail('media bindingReference must be a non-empty reference', 'GATHER_INSTANCES_INVALID', {
      field: 'bindingReference',
    });
  }
  return reference;
};

const rowToInstance = (row) => {
  if (!row) return null;
  return {
    localInstanceId: row.local_instance_id,
    odkInstanceId: row.odk_instance_id,
    projectKey: row.project_key,
    formId: row.form_id,
    formVersionId: row.form_version_id,
    formVersion: row.form_version,
    formHash: row.form_hash,
    state: row.state,
    xmlFileKey: row.xml_file_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at ?? null,
    sentAt: row.sent_at ?? null,
    sendReceipt: row.send_receipt ?? null,
    sendError: row.send_error ?? null,
  };
};

const rowToMedia = (row) => {
  if (!row) return null;
  return {
    localInstanceId: row.local_instance_id,
    bindingReference: row.binding_reference,
    filename: row.filename,
    contentType: row.content_type,
    fileKey: row.file_key,
  };
};

const assertDb = (db) => {
  if (
    !db ||
    typeof db.getAllAsync !== 'function' ||
    typeof db.getFirstAsync !== 'function' ||
    typeof db.runAsync !== 'function' ||
    typeof db.withTransactionAsync !== 'function'
  ) {
    fail('createInstancesRepository requires a db adapter', 'GATHER_INSTANCES_NO_DB');
  }
};

const INSTANCE_COLUMNS = `
  local_instance_id, odk_instance_id, project_key, form_id, form_version_id,
  form_version, form_hash, state, xml_file_key, created_at, updated_at,
  finalized_at, sent_at, send_receipt, send_error`;
const MEDIA_COLUMNS = 'local_instance_id, binding_reference, filename, content_type, file_key';

const assertDraftInput = (input = {}) => ({
  localInstanceId: assertLocalInstanceId(input.localInstanceId),
  odkInstanceId: nonEmpty(input.odkInstanceId, 'odkInstanceId'),
  projectKey: assertProjectKey(input.projectKey),
  formId: nonEmpty(input.formId, 'formId'),
  formVersionId: nonEmpty(input.formVersionId, 'formVersionId'),
  formVersion: typeof input.formVersion === 'string' ? input.formVersion : '',
  formHash: typeof input.formHash === 'string' ? input.formHash : '',
  xmlFileKey: assertRelativeKey(input.xmlFileKey),
});

const assertMediaInput = (input = {}) => ({
  localInstanceId: assertLocalInstanceId(input.localInstanceId),
  bindingReference: assertBindingReference(input.bindingReference),
  filename: assertMediaFilename(input.filename),
  contentType: assertMediaContentType(input.contentType),
  fileKey: assertRelativeKey(input.fileKey),
});

/**
 * @param {{ getAllAsync: Function, getFirstAsync: Function, runAsync: Function,
 *   withTransactionAsync: Function }} db Expo SQLite's async shape or a test seam.
 */
export const createInstancesRepository = (db) => {
  assertDb(db);

  const get = async (localInstanceId) => {
    const row = await db.getFirstAsync(
      `SELECT ${INSTANCE_COLUMNS} FROM instances WHERE local_instance_id = ? LIMIT 1;`,
      [assertLocalInstanceId(localInstanceId)]
    );
    return rowToInstance(row);
  };

  const requireState = async (localInstanceId, state) => {
    const instance = await get(localInstanceId);
    if (!instance) {
      fail('Instance was not found', 'GATHER_INSTANCES_NOT_FOUND', { localInstanceId });
    }
    if (instance.state !== state) {
      fail(`Instance is ${instance.state}, not ${state}`, 'GATHER_INSTANCES_INVALID_TRANSITION', {
        localInstanceId,
        from: instance.state,
        to: state,
      });
    }
    return instance;
  };

  return {
    get,

    async list(projectKey, { state = null } = {}) {
      const key = assertProjectKey(projectKey);
      if (state != null && !STATE_SET.has(state)) {
        fail('state is invalid', 'GATHER_INSTANCES_INVALID', { state });
      }
      const rows =
        state == null
          ? await db.getAllAsync(
              `SELECT ${INSTANCE_COLUMNS}
                 FROM instances WHERE project_key = ?
                ORDER BY updated_at DESC, local_instance_id DESC;`,
              [key]
            )
          : await db.getAllAsync(
              `SELECT ${INSTANCE_COLUMNS}
                 FROM instances WHERE project_key = ? AND state = ?
                ORDER BY updated_at DESC, local_instance_id DESC;`,
              [key, state]
            );
      return (rows ?? []).map(rowToInstance);
    },

    async listMedia(localInstanceId) {
      const id = assertLocalInstanceId(localInstanceId);
      const rows = await db.getAllAsync(
        `SELECT ${MEDIA_COLUMNS}
           FROM instance_media
          WHERE local_instance_id = ?
          ORDER BY binding_reference ASC;`,
        [id]
      );
      return (rows ?? []).map(rowToMedia);
    },

    async upsertMedia(input) {
      const value = assertMediaInput(input);
      await requireState(value.localInstanceId, INSTANCE_STATES.DRAFT);
      await db.runAsync(
        `INSERT INTO instance_media (
           local_instance_id, binding_reference, filename, content_type, file_key
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(local_instance_id, binding_reference) DO UPDATE SET
           filename = excluded.filename,
           content_type = excluded.content_type,
           file_key = excluded.file_key;`,
        [
          value.localInstanceId,
          value.bindingReference,
          value.filename,
          value.contentType,
          value.fileKey,
        ]
      );
      return value;
    },

    async createDraft(input) {
      const value = assertDraftInput(input);
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO instances (
             local_instance_id, odk_instance_id, project_key, form_id,
             form_version_id, form_version, form_hash, state, xml_file_key
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?);`,
          [
            value.localInstanceId,
            value.odkInstanceId,
            value.projectKey,
            value.formId,
            value.formVersionId,
            value.formVersion,
            value.formHash,
            value.xmlFileKey,
          ]
        );
      });
      return get(value.localInstanceId);
    },

    /** Update draft metadata only after the caller has atomically rewritten XML. */
    async saveDraft({ localInstanceId, odkInstanceId } = {}) {
      const id = assertLocalInstanceId(localInstanceId);
      await requireState(id, INSTANCE_STATES.DRAFT);
      await db.runAsync(
        `UPDATE instances
            SET odk_instance_id = ?, send_error = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE local_instance_id = ? AND state = 'draft';`,
        [nonEmpty(odkInstanceId, 'odkInstanceId'), id]
      );
      return get(id);
    },

    /** Validated XML has already been atomically written by the caller. */
    async markReady({ localInstanceId, odkInstanceId } = {}) {
      const id = assertLocalInstanceId(localInstanceId);
      await requireState(id, INSTANCE_STATES.DRAFT);
      await db.runAsync(
        `UPDATE instances
            SET state = 'ready', odk_instance_id = ?, send_error = NULL,
                finalized_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE local_instance_id = ? AND state = 'draft';`,
        [nonEmpty(odkInstanceId, 'odkInstanceId'), id]
      );
      return get(id);
    },

    async markSendFailure({ localInstanceId, sendError } = {}) {
      const id = assertLocalInstanceId(localInstanceId);
      await requireState(id, INSTANCE_STATES.READY);
      await db.runAsync(
        `UPDATE instances
            SET send_error = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE local_instance_id = ? AND state = 'ready';`,
        [nonEmpty(sendError, 'sendError'), id]
      );
      return get(id);
    },

    async markSent({ localInstanceId, sendReceipt = null } = {}) {
      const id = assertLocalInstanceId(localInstanceId);
      await requireState(id, INSTANCE_STATES.READY);
      await db.runAsync(
        `UPDATE instances
            SET state = 'sent', send_receipt = ?, send_error = NULL,
                sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE local_instance_id = ? AND state = 'ready';`,
        [safeTextOrNull(sendReceipt, 'sendReceipt'), id]
      );
      return get(id);
    },

    /** Only mutable drafts may be discarded; sent XML is retained for audit/retry evidence. */
    async removeDraft(localInstanceId) {
      const id = assertLocalInstanceId(localInstanceId);
      await requireState(id, INSTANCE_STATES.DRAFT);
      await db.runAsync(`DELETE FROM instances WHERE local_instance_id = ? AND state = 'draft';`, [id]);
    },
  };
};

export { rowToInstance, rowToMedia };
