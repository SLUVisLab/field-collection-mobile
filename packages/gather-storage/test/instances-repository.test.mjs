import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInstancesRepository,
  InstancesRepositoryError,
} from '../src/repositories/instances.js';

const columns = [
  'local_instance_id',
  'odk_instance_id',
  'project_key',
  'form_id',
  'form_version_id',
  'form_version',
  'form_hash',
  'state',
  'xml_file_key',
  'created_at',
  'updated_at',
  'finalized_at',
  'sent_at',
  'send_receipt',
  'send_error',
];

const makeFakeDb = () => {
  const rows = new Map();
  const mediaRows = new Map();
  const receiptRows = new Map();
  const clone = (row) => (row ? { ...row } : null);
  return {
    rows,
    mediaRows,
    receiptRows,
    async getFirstAsync(sql, params) {
      if (sql.includes('FROM instance_receipts')) {
        const [id, reference] = params;
        return clone(receiptRows.get(`${id}:${reference}`));
      }
      return clone(rows.get(params[0]));
    },
    async getAllAsync(sql, [projectKey, state]) {
      if (sql.includes('FROM instance_receipts')) {
        return [...receiptRows.values()]
          .filter((row) => row.local_instance_id === projectKey)
          .sort((a, b) => a.binding_reference.localeCompare(b.binding_reference))
          .map(clone);
      }
      if (sql.includes('FROM instance_media')) {
        return [...mediaRows.values()]
          .filter((row) => row.local_instance_id === projectKey)
          .sort((a, b) => a.binding_reference.localeCompare(b.binding_reference))
          .map(clone);
      }
      return [...rows.values()]
        .filter((row) => row.project_key === projectKey && (state == null || row.state === state))
        .sort((a, b) => b.local_instance_id.localeCompare(a.local_instance_id))
        .map(clone);
    },
    async runAsync(sql, params = []) {
      if (sql.includes('INSERT INTO instance_receipts')) {
        const [
          local_instance_id,
          binding_reference,
          capability,
          capability_revision,
          revision,
          receipt_json,
        ] = params;
        receiptRows.set(`${local_instance_id}:${binding_reference}`, {
          local_instance_id,
          binding_reference,
          capability,
          capability_revision,
          revision,
          recorded_at: 'recorded',
          receipt_json,
        });
        return { changes: 1 };
      }
      if (sql.includes('DELETE FROM instance_receipts')) {
        const [id, reference] = params;
        receiptRows.delete(`${id}:${reference}`);
        return { changes: 1 };
      }
      if (sql.includes('INSERT INTO instance_media')) {
        const [
          local_instance_id,
          binding_reference,
          filename,
          content_type,
          file_key,
        ] = params;
        mediaRows.set(`${local_instance_id}:${binding_reference}`, {
          local_instance_id,
          binding_reference,
          filename,
          content_type,
          file_key,
        });
        return { changes: 1 };
      }
      if (sql.includes('INSERT INTO instances')) {
        const row = Object.fromEntries(columns.map((column) => [column, null]));
        [
          row.local_instance_id,
          row.odk_instance_id,
          row.project_key,
          row.form_id,
          row.form_version_id,
          row.form_version,
          row.form_hash,
          row.xml_file_key,
        ] = params;
        row.state = 'draft';
        row.created_at = row.updated_at = 'created';
        rows.set(row.local_instance_id, row);
        return { changes: 1 };
      }
      const id = params.at(-1);
      const row = rows.get(id);
      if (sql.includes('SET state = \'ready\'')) {
        row.state = 'ready';
        row.odk_instance_id = params[0];
        row.finalized_at = 'finalized';
      } else if (sql.includes('SET state = \'sent\'')) {
        row.state = 'sent';
        row.send_receipt = params[0];
        row.send_error = null;
        row.sent_at = 'sent';
      } else if (sql.includes('SET send_error')) {
        row.send_error = params[0];
      } else if (sql.includes('SET odk_instance_id')) {
        row.odk_instance_id = params[0];
        row.send_error = null;
      } else if (sql.includes('DELETE FROM instances')) {
        rows.delete(id);
      } else {
        throw new Error(`unexpected SQL: ${sql}`);
      }
      if (row) row.updated_at = 'updated';
      return { changes: 1 };
    },
    async withTransactionAsync(fn) {
      await fn();
    },
  };
};

const draft = {
  localInstanceId: 'i-1',
  odkInstanceId: 'uuid:odk-1',
  projectKey: 'project-1',
  formId: 'field observation',
  formVersionId: 'version-1',
  formVersion: '20260828',
  formHash: 'md5:immutable',
  xmlFileKey: 'projects/project-1/instances/i-1/instance.xml',
};

test('instance repository records only XML metadata and exact immutable form identity', async () => {
  const db = makeFakeDb();
  const repo = createInstancesRepository(db);
  const stored = await repo.createDraft(draft);

  assert.deepEqual(
    {
      localInstanceId: stored.localInstanceId,
      odkInstanceId: stored.odkInstanceId,
      projectKey: stored.projectKey,
      formId: stored.formId,
      formVersionId: stored.formVersionId,
      formVersion: stored.formVersion,
      formHash: stored.formHash,
      state: stored.state,
      xmlFileKey: stored.xmlFileKey,
    },
    { ...draft, state: 'draft' }
  );
  assert.equal(JSON.stringify(db.rows.get('i-1')).includes('<data'), false, 'SQLite has no answer/XML payload');
  await assert.rejects(repo.createDraft({ ...draft, localInstanceId: 'i-2', xmlFileKey: '/not-relative.xml' }));
});

test('instance state transitions allow draft → ready → sent and reject reverse mutation', async () => {
  const repo = createInstancesRepository(makeFakeDb());
  await repo.createDraft(draft);
  const saved = await repo.saveDraft({ localInstanceId: 'i-1', odkInstanceId: 'uuid:odk-2' });
  assert.equal(saved.odkInstanceId, 'uuid:odk-2');

  const ready = await repo.markReady({ localInstanceId: 'i-1', odkInstanceId: 'uuid:odk-2' });
  assert.equal(ready.state, 'ready');
  const failed = await repo.markSendFailure({ localInstanceId: 'i-1', sendError: 'offline' });
  assert.equal(failed.state, 'ready');
  assert.equal(failed.sendError, 'offline');

  const sent = await repo.markSent({ localInstanceId: 'i-1', sendReceipt: '{"status":201}' });
  assert.equal(sent.state, 'sent');
  await assert.rejects(repo.saveDraft({ localInstanceId: 'i-1', odkInstanceId: 'uuid:odk-3' }), InstancesRepositoryError);
  await assert.rejects(repo.markSendFailure({ localInstanceId: 'i-1', sendError: 'retry' }), InstancesRepositoryError);
  await assert.rejects(repo.removeDraft('i-1'), InstancesRepositoryError);
});

test('instance media records only a safe filename, content type, and relative file key', async () => {
  const db = makeFakeDb();
  const repo = createInstancesRepository(db);
  await repo.createDraft(draft);
  const media = await repo.upsertMedia({
    localInstanceId: 'i-1',
    bindingReference: '/data/flower_photo',
    filename: 'image-abc123.jpg',
    contentType: 'image/jpeg',
    fileKey: 'projects/project-1/media/i-1/image-abc123.jpg',
  });

  assert.deepEqual(await repo.listMedia('i-1'), [media]);
  assert.equal(JSON.stringify(db.mediaRows.get('i-1:/data/flower_photo')).includes('<data'), false);
  await assert.rejects(
    repo.upsertMedia({
      ...media,
      filename: '../unsafe.jpg',
    }),
    InstancesRepositoryError
  );
});

// Provenance for computed field values — docs/b-custom-composition-conventions.md.
// The presence or absence of a receipt is what tells a Gather-computed value
// apart from one typed by hand in another ODK client, because the backing
// fields stay ordinary writable XForms values rather than readonly (principle 5).

const receiptFor = (overrides = {}) => ({
  capability: 'measure.area',
  capabilityRevision: 'rev-1',
  revision: 'digest-1',
  model: null,
  inputs: { imageDigest: 'sha256:abc' },
  parameters: {},
  outputs: { area: 12.4 },
  runtime: { onnx: '1.18.0' },
  timestamp: '2026-09-02T00:00:00.000Z',
  ...overrides,
});

test('a receipt records how one projected field was produced', async () => {
  const repo = createInstancesRepository(makeFakeDb());
  await repo.createDraft(draft);

  const stored = await repo.upsertReceipt({
    localInstanceId: 'i-1',
    bindingReference: '/data/leaf_area',
    receipt: receiptFor(),
  });
  assert.equal(stored.capability, 'measure.area');
  assert.equal(stored.revision, 'digest-1');

  const found = await repo.getReceipt({
    localInstanceId: 'i-1',
    bindingReference: '/data/leaf_area',
  });
  // The receipt survives verbatim, not just the indexed columns.
  assert.deepEqual(found.receipt, receiptFor());
  assert.equal(found.bindingReference, '/data/leaf_area');
  assert.ok(found.recordedAt);
});

test('a field with no receipt reads as null — the manual-entry signal', async () => {
  const repo = createInstancesRepository(makeFakeDb());
  await repo.createDraft(draft);

  assert.equal(
    await repo.getReceipt({ localInstanceId: 'i-1', bindingReference: '/data/typed_by_hand' }),
    null
  );
  assert.deepEqual(await repo.listReceipts('i-1'), []);
});

test('re-running a composition replaces the receipt rather than accumulating', async () => {
  const repo = createInstancesRepository(makeFakeDb());
  await repo.createDraft(draft);
  const reference = '/data/leaf_area';

  await repo.upsertReceipt({ localInstanceId: 'i-1', bindingReference: reference, receipt: receiptFor() });
  await repo.upsertReceipt({
    localInstanceId: 'i-1',
    bindingReference: reference,
    receipt: receiptFor({ revision: 'digest-2', outputs: { area: 15.9 } }),
  });

  const all = await repo.listReceipts('i-1');
  assert.equal(all.length, 1, 'a field carries one receipt, from the run that produced its value');
  assert.equal(all[0].revision, 'digest-2');
  assert.deepEqual(all[0].receipt.outputs, { area: 15.9 });
});

test('clearing a projected value must be able to drop its provenance', async () => {
  // An optional output absent this run clears the field (B-custom §7). A
  // receipt left behind would claim provenance for a value that is gone.
  const repo = createInstancesRepository(makeFakeDb());
  await repo.createDraft(draft);
  await repo.upsertReceipt({
    localInstanceId: 'i-1',
    bindingReference: '/data/petal_count',
    receipt: receiptFor({ capability: 'image.classify' }),
  });

  await repo.deleteReceipt({ localInstanceId: 'i-1', bindingReference: '/data/petal_count' });
  assert.equal(
    await repo.getReceipt({ localInstanceId: 'i-1', bindingReference: '/data/petal_count' }),
    null
  );
  // Deleting an absent receipt is not an error — clearing is idempotent.
  await repo.deleteReceipt({ localInstanceId: 'i-1', bindingReference: '/data/petal_count' });
});

test('receipts list per instance in binding order', async () => {
  const repo = createInstancesRepository(makeFakeDb());
  await repo.createDraft(draft);
  for (const reference of ['/data/petal_count', '/data/leaf_area', '/data/color']) {
    await repo.upsertReceipt({ localInstanceId: 'i-1', bindingReference: reference, receipt: receiptFor() });
  }
  assert.deepEqual(
    (await repo.listReceipts('i-1')).map((entry) => entry.bindingReference),
    ['/data/color', '/data/leaf_area', '/data/petal_count']
  );
});

test('provenance is only written while the value is being collected', async () => {
  const repo = createInstancesRepository(makeFakeDb());
  await repo.createDraft(draft);
  await repo.markReady({ localInstanceId: 'i-1', odkInstanceId: 'uuid:odk-1' });

  await assert.rejects(
    () => repo.upsertReceipt({
      localInstanceId: 'i-1',
      bindingReference: '/data/leaf_area',
      receipt: receiptFor(),
    }),
    InstancesRepositoryError
  );
});

test('reading provenance is not restricted by state — audit outlives submission', async () => {
  const repo = createInstancesRepository(makeFakeDb());
  await repo.createDraft(draft);
  await repo.upsertReceipt({
    localInstanceId: 'i-1',
    bindingReference: '/data/leaf_area',
    receipt: receiptFor(),
  });
  await repo.markReady({ localInstanceId: 'i-1', odkInstanceId: 'uuid:odk-1' });
  await repo.markSent({ localInstanceId: 'i-1', sendReceipt: 'ok' });

  const found = await repo.getReceipt({ localInstanceId: 'i-1', bindingReference: '/data/leaf_area' });
  assert.equal(found.capability, 'measure.area');
  assert.equal((await repo.listReceipts('i-1')).length, 1);
});

test('a receipt must be a serializable object with the fields provenance needs', async () => {
  const repo = createInstancesRepository(makeFakeDb());
  await repo.createDraft(draft);
  const base = { localInstanceId: 'i-1', bindingReference: '/data/leaf_area' };

  await assert.rejects(() => repo.upsertReceipt({ ...base }), InstancesRepositoryError);
  await assert.rejects(() => repo.upsertReceipt({ ...base, receipt: 'nope' }), InstancesRepositoryError);
  await assert.rejects(() => repo.upsertReceipt({ ...base, receipt: [] }), InstancesRepositoryError);
  // A receipt with no capability or revision cannot answer "how was this made".
  await assert.rejects(
    () => repo.upsertReceipt({ ...base, receipt: receiptFor({ capability: '' }) }),
    InstancesRepositoryError
  );
  await assert.rejects(
    () => repo.upsertReceipt({ ...base, receipt: receiptFor({ revision: '' }) }),
    InstancesRepositoryError
  );
  // Circular structures cannot be stored.
  const circular = receiptFor();
  circular.self = circular;
  await assert.rejects(() => repo.upsertReceipt({ ...base, receipt: circular }), InstancesRepositoryError);
  // And the binding reference is validated the same way media's is.
  await assert.rejects(
    () => repo.upsertReceipt({ localInstanceId: 'i-1', bindingReference: '', receipt: receiptFor() }),
    InstancesRepositoryError
  );
});
