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
  const clone = (row) => (row ? { ...row } : null);
  return {
    rows,
    mediaRows,
    async getFirstAsync(_sql, [id]) {
      return clone(rows.get(id));
    },
    async getAllAsync(sql, [projectKey, state]) {
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
