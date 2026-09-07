import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSET_RETENTION,
  AssetsRepositoryError,
  createAssetsRepository,
} from '../src/repositories/assets.js';

// The ledger that makes project cleanup safe.
// See docs/b-custom-composition-conventions.md §4.

const makeFakeDb = () => {
  const rows = new Map();
  const clone = (row) => (row ? { ...row } : null);
  return {
    rows,
    async getFirstAsync(_sql, [fileKey]) {
      return clone(rows.get(fileKey));
    },
    async getAllAsync(_sql, [projectKey]) {
      return [...rows.values()]
        .filter((row) => row.project_key === projectKey)
        .sort((a, b) => a.file_key.localeCompare(b.file_key))
        .map(clone);
    },
    async runAsync(sql, params = []) {
      if (sql.includes('INSERT INTO project_assets')) {
        const [file_key, project_key, asset_id, content_type, retention, local_instance_id] = params;
        const existing = rows.get(file_key);
        rows.set(file_key, {
          file_key,
          project_key,
          asset_id,
          content_type,
          retention,
          local_instance_id: local_instance_id ?? null,
          created_at: existing?.created_at ?? 'created',
          released_at: existing?.released_at ?? null,
        });
        return { changes: 1 };
      }
      if (sql.includes('SET retention')) {
        const row = rows.get(params[1]);
        if (row) row.retention = params[0];
        return { changes: row ? 1 : 0 };
      }
      if (sql.includes('SET released_at')) {
        const row = rows.get(params[0]);
        if (row) row.released_at = 'released';
        return { changes: row ? 1 : 0 };
      }
      if (sql.includes('DELETE FROM project_assets')) {
        rows.delete(params[0]);
        return { changes: 1 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    async withTransactionAsync(fn) {
      await fn();
    },
  };
};

const input = (overrides = {}) => ({
  fileKey: 'projects/p1/media/image-a.jpg',
  projectKey: 'p1',
  assetId: 'image-a',
  contentType: 'image/jpeg',
  retention: ASSET_RETENTION.KEEP,
  ...overrides,
});

test('a working asset settles its disposition later, when the output is known', async () => {
  // recordAsset writes a PROVISIONAL retention: at capture time nothing knows
  // what role the bytes will play. Completion is where that is finally known.
  const repo = createAssetsRepository(makeFakeDb());
  await repo.recordAsset(input({ retention: ASSET_RETENTION.DISCARD }));

  assert.deepEqual(await repo.setRetention({ fileKey: input().fileKey, retention: 'keep' }), {
    fileKey: input().fileKey,
    retention: 'keep',
  });
  assert.equal((await repo.getAsset(input().fileKey)).retention, 'keep');

  // Still a closed set. An unrecognised value must not reach the row.
  await assert.rejects(
    () => repo.setRetention({ fileKey: input().fileKey, retention: 'maybe' }),
    AssetsRepositoryError
  );
  assert.equal((await repo.getAsset(input().fileKey)).retention, 'keep');
});

test('an asset records its retention explicitly', async () => {
  const repo = createAssetsRepository(makeFakeDb());
  const stored = await repo.recordAsset(input());
  assert.equal(stored.retention, 'keep');

  const found = await repo.getAsset('projects/p1/media/image-a.jpg');
  assert.equal(found.assetId, 'image-a');
  assert.equal(found.retention, 'keep');
  assert.equal(found.releasedAt, null, 'a new asset is not released');
  assert.equal(found.localInstanceId, null);
});

test('retention is required and never inferred', async () => {
  // B-custom §4: persistence is authoring policy, not a consequence of type.
  const repo = createAssetsRepository(makeFakeDb());
  await assert.rejects(
    () => repo.recordAsset({ ...input(), retention: undefined }),
    AssetsRepositoryError
  );
  await assert.rejects(
    () => repo.recordAsset({ ...input(), retention: 'maybe' }),
    AssetsRepositoryError
  );
});

test('recording the same file twice updates rather than duplicating', async () => {
  const repo = createAssetsRepository(makeFakeDb());
  await repo.recordAsset(input());
  await repo.recordAsset(input({ retention: ASSET_RETENTION.DISCARD, assetId: 'image-a2' }));

  const all = await repo.listAssets('p1');
  assert.equal(all.length, 1);
  assert.equal(all[0].retention, 'discard');
  assert.equal(all[0].assetId, 'image-a2');
});

test('releasing is what makes discard safe', async () => {
  // Bytes survive until the producer says they are no longer needed, so
  // "discard" can never mean "delete immediately after compute".
  const repo = createAssetsRepository(makeFakeDb());
  await repo.recordAsset(input({ retention: ASSET_RETENTION.DISCARD }));
  assert.equal((await repo.getAsset(input().fileKey)).releasedAt, null);

  await repo.releaseAsset(input().fileKey);
  assert.ok((await repo.getAsset(input().fileKey)).releasedAt);
});

test('assets list per project, and a project sees only its own', async () => {
  const repo = createAssetsRepository(makeFakeDb());
  await repo.recordAsset(input({ fileKey: 'projects/p1/media/b.jpg', assetId: 'b' }));
  await repo.recordAsset(input({ fileKey: 'projects/p1/media/a.jpg', assetId: 'a' }));
  await repo.recordAsset(input({ fileKey: 'projects/p2/media/c.jpg', projectKey: 'p2', assetId: 'c' }));

  assert.deepEqual(
    (await repo.listAssets('p1')).map((entry) => entry.assetId),
    ['a', 'b']
  );
  assert.deepEqual((await repo.listAssets('p2')).map((entry) => entry.assetId), ['c']);
});

test('deleting a row forgets the asset without claiming to delete bytes', async () => {
  const repo = createAssetsRepository(makeFakeDb());
  await repo.recordAsset(input());
  await repo.deleteAsset(input().fileKey);
  assert.equal(await repo.getAsset(input().fileKey), null);
});

test('keys and identifiers are validated', async () => {
  const repo = createAssetsRepository(makeFakeDb());
  // Path shapes are the path layer's contract, so they keep its error type —
  // the same split every other repository has.
  await assert.rejects(() => repo.recordAsset(input({ fileKey: '/absolute.jpg' })), /must not be absolute/);
  await assert.rejects(() => repo.recordAsset(input({ projectKey: '' })), /projectKey must be/);
  // Everything this repository owns itself reports as its own error.
  await assert.rejects(() => repo.recordAsset(input({ assetId: '' })), AssetsRepositoryError);
  await assert.rejects(() => repo.recordAsset(input({ contentType: '' })), AssetsRepositoryError);
  await assert.rejects(
    () => repo.recordAsset(input({ localInstanceId: '' })),
    AssetsRepositoryError
  );
  assert.throws(() => createAssetsRepository(null), AssetsRepositoryError);
});

test('an asset can name the instance it was produced for', async () => {
  const repo = createAssetsRepository(makeFakeDb());
  await repo.recordAsset(input({ localInstanceId: 'i-1' }));
  assert.equal((await repo.getAsset(input().fileKey)).localInstanceId, 'i-1');
});
