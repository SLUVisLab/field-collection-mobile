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

const RECEIPT_COLUMNS =
  'local_instance_id, binding_reference, capability, capability_revision, revision, recorded_at, receipt_json';

const rowToReceipt = (row) => {
  if (!row) return null;
  let receipt = null;
  try {
    receipt = JSON.parse(row.receipt_json);
  } catch {
    // A row that cannot be parsed is still evidence that a value was computed,
    // which is what principle 5 asks. Surface the metadata and leave `receipt`
    // null rather than failing the whole read.
    receipt = null;
  }
  return {
    localInstanceId: row.local_instance_id,
    bindingReference: row.binding_reference,
    capability: row.capability,
    capabilityRevision: row.capability_revision,
    revision: row.revision,
    recordedAt: row.recorded_at,
    receipt,
  };
};

/**
 * A receipt is opaque provenance produced by `createExecutionReceipt`. Only the
 * fields this layer indexes are validated; the rest is stored verbatim.
 */
const assertReceiptInput = (input = {}) => {
  const receipt = input.receipt;
  if (receipt == null || typeof receipt !== 'object' || Array.isArray(receipt)) {
    fail('receipt must be an object', 'GATHER_INSTANCES_INVALID', { field: 'receipt' });
  }
  let receiptJson;
  try {
    receiptJson = JSON.stringify(receipt);
  } catch {
    fail('receipt must be JSON-serializable', 'GATHER_INSTANCES_INVALID', { field: 'receipt' });
  }
  if (typeof receiptJson !== 'string') {
    fail('receipt must be JSON-serializable', 'GATHER_INSTANCES_INVALID', { field: 'receipt' });
  }
  return {
    localInstanceId: assertLocalInstanceId(input.localInstanceId),
    bindingReference: assertBindingReference(input.bindingReference),
    capability: nonEmpty(receipt.capability, 'receipt.capability'),
    capabilityRevision: nonEmpty(receipt.capabilityRevision, 'receipt.capabilityRevision'),
    revision: nonEmpty(receipt.revision, 'receipt.revision'),
    receiptJson,
    receipt,
  };
};

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
          ORDER BY filename ASC;`,
        [id]
      );
      return (rows ?? []).map(rowToMedia);
    },

    async deleteMedia({ localInstanceId, filename } = {}) {
      const id = assertLocalInstanceId(localInstanceId);
      const name = assertMediaFilename(filename);
      await db.runAsync(
        `DELETE FROM instance_media
           WHERE local_instance_id = ? AND filename = ?;`,
        [id, name]
      );
      return { localInstanceId: id, filename: name };
    },

    async upsertMedia(input) {
      const value = assertMediaInput(input);
      await requireState(value.localInstanceId, INSTANCE_STATES.DRAFT);
      await db.runAsync(
        `INSERT INTO instance_media (
           local_instance_id, binding_reference, filename, content_type, file_key
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(local_instance_id, filename) DO UPDATE SET
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

    /**
     * Records how one projected field's value was produced.
     *
     * Draft-only, like `upsertMedia`: provenance is written while the value is
     * being collected. Re-running a composition replaces the row, so a field
     * never carries provenance from a superseded run.
     */
    async upsertReceipt(input) {
      const value = assertReceiptInput(input);
      await requireState(value.localInstanceId, INSTANCE_STATES.DRAFT);
      await db.runAsync(
        `INSERT INTO instance_receipts (
           local_instance_id, binding_reference, capability, capability_revision,
           revision, recorded_at, receipt_json
         ) VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)
         ON CONFLICT(local_instance_id, binding_reference) DO UPDATE SET
           capability = excluded.capability,
           capability_revision = excluded.capability_revision,
           revision = excluded.revision,
           recorded_at = excluded.recorded_at,
           receipt_json = excluded.receipt_json;`,
        [
          value.localInstanceId,
          value.bindingReference,
          value.capability,
          value.capabilityRevision,
          value.revision,
          value.receiptJson,
        ]
      );
      return {
        localInstanceId: value.localInstanceId,
        bindingReference: value.bindingReference,
        capability: value.capability,
        capabilityRevision: value.capabilityRevision,
        revision: value.revision,
        receipt: value.receipt,
      };
    },

    /** Every receipt on an instance, in binding order. No state restriction: a
     * sent instance's provenance must stay readable for audit. */
    async listReceipts(localInstanceId) {
      const id = assertLocalInstanceId(localInstanceId);
      const rows = await db.getAllAsync(
        `SELECT ${RECEIPT_COLUMNS}
           FROM instance_receipts
          WHERE local_instance_id = ?
          ORDER BY binding_reference ASC;`,
        [id]
      );
      return (rows ?? []).map(rowToReceipt);
    },

    /**
     * The receipt for one projected field, or `null`.
     *
     * `null` is the load-bearing answer: it is how a value typed by hand in
     * another ODK client is told apart from one Gather computed.
     */
    async getReceipt({ localInstanceId, bindingReference } = {}) {
      const id = assertLocalInstanceId(localInstanceId);
      const reference = assertBindingReference(bindingReference);
      const row = await db.getFirstAsync(
        `SELECT ${RECEIPT_COLUMNS}
           FROM instance_receipts
          WHERE local_instance_id = ? AND binding_reference = ?;`,
        [id, reference]
      );
      return rowToReceipt(row);
    },

    /**
     * Drops the provenance for one field.
     *
     * Required when a projected value is cleared — an optional output that was
     * not produced this run (B-custom §7). A receipt left behind on a cleared
     * field would claim provenance for a value that is no longer there.
     */
    async deleteReceipt({ localInstanceId, bindingReference } = {}) {
      const id = assertLocalInstanceId(localInstanceId);
      const reference = assertBindingReference(bindingReference);
      await db.runAsync(
        `DELETE FROM instance_receipts
           WHERE local_instance_id = ? AND binding_reference = ?;`,
        [id, reference]
      );
      return { localInstanceId: id, bindingReference: reference };
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
