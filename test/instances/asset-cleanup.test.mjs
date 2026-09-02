import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLEANUP_REASONS,
  planAssetCleanup,
  runAssetCleanup,
  sweepProjectAssets,
} from '../../src/instances/assetCleanup.js';

// Conventions in docs/b-custom-composition-conventions.md §4.

const asset = (fileKey, retention, releasedAt = null) => ({ fileKey, retention, releasedAt });
const reasonFor = (plan, list, fileKey) =>
  plan[list].find((entry) => entry.fileKey === fileKey)?.reason ?? null;

test('a form attachment is never deleted, whatever the ledger says', () => {
  // This is what stops `retention: discard` on a submitted output from meaning
  // "delete immediately after compute" — the bytes must survive the handoff.
  const plan = planAssetCleanup({
    presentFileKeys: ['p/media/submitted.jpg'],
    attachmentFileKeys: ['p/media/submitted.jpg'],
    ledger: [asset('p/media/submitted.jpg', 'discard', '2026-09-02T00:00:00.000Z')],
    reclaimOrphans: true,
  });

  assert.deepEqual(plan.deleteFiles, []);
  assert.equal(reasonFor(plan, 'keepFiles', 'p/media/submitted.jpg'), CLEANUP_REASONS.ATTACHMENT);
});

test('a kept local-only asset survives a sweep', () => {
  // The `projection: none, retention: keep` case: referenced by nothing in the
  // database, and deliberately so.
  const plan = planAssetCleanup({
    presentFileKeys: ['p/media/scan.jpg'],
    attachmentFileKeys: [],
    ledger: [asset('p/media/scan.jpg', 'keep')],
    reclaimOrphans: true,
  });

  assert.deepEqual(plan.deleteFiles, []);
  assert.equal(reasonFor(plan, 'keepFiles', 'p/media/scan.jpg'), CLEANUP_REASONS.RETAINED);
});

test('discard only reclaims once the producer has released it', () => {
  const unreleased = planAssetCleanup({
    presentFileKeys: ['p/media/tmp.jpg'],
    ledger: [asset('p/media/tmp.jpg', 'discard')],
  });
  assert.deepEqual(unreleased.deleteFiles, []);
  assert.equal(reasonFor(unreleased, 'keepFiles', 'p/media/tmp.jpg'), CLEANUP_REASONS.IN_USE);

  const released = planAssetCleanup({
    presentFileKeys: ['p/media/tmp.jpg'],
    ledger: [asset('p/media/tmp.jpg', 'discard', '2026-09-02T00:00:00.000Z')],
  });
  assert.equal(reasonFor(released, 'deleteFiles', 'p/media/tmp.jpg'), CLEANUP_REASONS.RELEASED);
  // Deleting the bytes takes the row with them.
  assert.equal(reasonFor(released, 'pruneRows', 'p/media/tmp.jpg'), CLEANUP_REASONS.RELEASED);
});

test('an unledgered file is kept by default — installs predate the ledger', () => {
  // persistScientificCapture wrote into project media with no row for a long
  // time. Treating unknown files as garbage by default would be data loss.
  const conservative = planAssetCleanup({ presentFileKeys: ['p/media/legacy.jpg'] });
  assert.deepEqual(conservative.deleteFiles, []);
  assert.equal(reasonFor(conservative, 'keepFiles', 'p/media/legacy.jpg'), CLEANUP_REASONS.UNLEDGERED);

  const reclaiming = planAssetCleanup({
    presentFileKeys: ['p/media/legacy.jpg'],
    reclaimOrphans: true,
  });
  assert.equal(reasonFor(reclaiming, 'deleteFiles', 'p/media/legacy.jpg'), CLEANUP_REASONS.UNLEDGERED);
  // Nothing to prune: there was never a row.
  assert.deepEqual(reclaiming.pruneRows, []);
});

test('a ledger row with no bytes is pruned, never treated as a file to delete', () => {
  const plan = planAssetCleanup({
    presentFileKeys: [],
    ledger: [asset('p/media/gone.jpg', 'keep')],
  });
  assert.deepEqual(plan.deleteFiles, []);
  assert.deepEqual(plan.keepFiles, []);
  assert.equal(reasonFor(plan, 'pruneRows', 'p/media/gone.jpg'), CLEANUP_REASONS.MISSING);
});

test('an unrecognised retention value is not permission to delete', () => {
  const plan = planAssetCleanup({
    presentFileKeys: ['p/media/odd.jpg'],
    ledger: [asset('p/media/odd.jpg', 'archive-forever')],
    reclaimOrphans: true,
  });
  assert.deepEqual(plan.deleteFiles, []);
  assert.equal(reasonFor(plan, 'keepFiles', 'p/media/odd.jpg'), CLEANUP_REASONS.RETAINED);
});

test('planning is stable and total over a mixed project', () => {
  const plan = planAssetCleanup({
    presentFileKeys: [
      'p/media/b-keep.jpg',
      'p/media/a-attach.jpg',
      'p/media/d-released.jpg',
      'p/media/c-inuse.jpg',
      'p/media/e-orphan.jpg',
    ],
    attachmentFileKeys: [{ fileKey: 'p/media/a-attach.jpg' }],
    ledger: [
      asset('p/media/b-keep.jpg', 'keep'),
      asset('p/media/c-inuse.jpg', 'discard'),
      asset('p/media/d-released.jpg', 'discard', 'then'),
      asset('p/media/f-missing.jpg', 'keep'),
    ],
  });

  // Every present file is classified exactly once.
  const classified = [...plan.deleteFiles, ...plan.keepFiles].map((entry) => entry.fileKey);
  assert.equal(new Set(classified).size, 5);
  assert.deepEqual(plan.deleteFiles.map((e) => e.fileKey), ['p/media/d-released.jpg']);
  assert.deepEqual(plan.keepFiles.map((e) => e.fileKey), [
    'p/media/a-attach.jpg',
    'p/media/b-keep.jpg',
    'p/media/c-inuse.jpg',
    'p/media/e-orphan.jpg',
  ]);
  assert.ok(plan.pruneRows.some((e) => e.fileKey === 'p/media/f-missing.jpg'));
});

test('accepts attachment rows in the shape listMedia returns', () => {
  const plan = planAssetCleanup({
    presentFileKeys: ['p/media/x.jpg'],
    attachmentFileKeys: [{ filename: 'x.jpg', fileKey: 'p/media/x.jpg', contentType: 'image/jpeg' }],
    reclaimOrphans: true,
  });
  assert.deepEqual(plan.deleteFiles, []);
});

test('execution deletes bytes before forgetting them', () => {
  const order = [];
  const plan = planAssetCleanup({
    presentFileKeys: ['p/media/tmp.jpg'],
    ledger: [asset('p/media/tmp.jpg', 'discard', 'then')],
  });

  return runAssetCleanup({
    plan,
    files: { deleteFile: async (key) => order.push(`file:${key}`) },
    assets: { deleteAsset: async (key) => order.push(`row:${key}`) },
  }).then((result) => {
    assert.deepEqual(order, ['file:p/media/tmp.jpg', 'row:p/media/tmp.jpg']);
    assert.deepEqual(result.deleted, ['p/media/tmp.jpg']);
    assert.deepEqual(result.pruned, ['p/media/tmp.jpg']);
    assert.deepEqual(result.failed, []);
  });
});

test('a failed byte delete leaves the row, so the next sweep can retry', async () => {
  // The reverse — forgetting the row first — would strand bytes that nothing
  // records, which is the unreclaimable case.
  const plan = planAssetCleanup({
    presentFileKeys: ['p/media/locked.jpg'],
    ledger: [asset('p/media/locked.jpg', 'discard', 'then')],
  });
  const pruned = [];

  const result = await runAssetCleanup({
    plan,
    files: { deleteFile: async () => { throw new Error('EBUSY'); } },
    assets: { deleteAsset: async (key) => pruned.push(key) },
  });

  assert.deepEqual(result.deleted, []);
  assert.deepEqual(pruned, [], 'the row must survive a failed byte delete');
  assert.equal(result.failed[0].message, 'EBUSY');
});

test('a missing file prunes its row without needing a delete to succeed', async () => {
  const plan = planAssetCleanup({ presentFileKeys: [], ledger: [asset('p/media/gone.jpg', 'keep')] });
  const result = await runAssetCleanup({
    plan,
    files: { deleteFile: async () => { throw new Error('should not be called'); } },
    assets: { deleteAsset: async () => {} },
  });
  assert.deepEqual(result.deleted, []);
  assert.deepEqual(result.pruned, ['p/media/gone.jpg']);
});

test('execution validates its own dependencies', async () => {
  await assert.rejects(() => runAssetCleanup({}), /requires a plan/);
  await assert.rejects(
    () => runAssetCleanup({ plan: { deleteFiles: [] } }),
    /requires files.deleteFile/
  );
  await assert.rejects(
    () => runAssetCleanup({ plan: { deleteFiles: [] }, files: { deleteFile: async () => {} } }),
    /requires assets.deleteAsset/
  );
});

test('a sweep reclaims released bytes and leaves everything else alone', async () => {
  const deleted = [];
  const pruned = [];
  const result = await sweepProjectAssets({
    projectKey: 'p1',
    mediaDirectoryKey: 'projects/p1/media',
    reclaimOrphans: false,
    files: {
      listDirectory: async () => [
        'projects/p1/media/attached.jpg',
        'projects/p1/media/kept.jpg',
        'projects/p1/media/released.jpg',
        'projects/p1/media/inuse.jpg',
        'projects/p1/media/legacy.jpg',
      ],
      deleteFile: async (key) => deleted.push(key),
    },
    instances: {
      listProjectMediaFileKeys: async () => ['projects/p1/media/attached.jpg'],
    },
    assets: {
      listAssets: async () => [
        { fileKey: 'projects/p1/media/kept.jpg', retention: 'keep', releasedAt: null },
        { fileKey: 'projects/p1/media/released.jpg', retention: 'discard', releasedAt: 'then' },
        { fileKey: 'projects/p1/media/inuse.jpg', retention: 'discard', releasedAt: null },
      ],
      deleteAsset: async (key) => pruned.push(key),
    },
  });

  assert.deepEqual(deleted, ['projects/p1/media/released.jpg']);
  assert.deepEqual(pruned, ['projects/p1/media/released.jpg']);
  assert.deepEqual(result.failed, []);
  // The attachment, the retained asset, the unreleased one and the legacy file
  // all survive — a sweep is not allowed to be clever about any of them.
  assert.equal(result.plan.keepFiles.length, 4);
});

test('a sweep on a project that never stored anything is a no-op', async () => {
  const result = await sweepProjectAssets({
    projectKey: 'p1',
    mediaDirectoryKey: 'projects/p1/media',
    files: { listDirectory: async () => [], deleteFile: async () => { throw new Error('no'); } },
    instances: { listProjectMediaFileKeys: async () => [] },
    assets: { listAssets: async () => [], deleteAsset: async () => { throw new Error('no'); } },
  });
  assert.deepEqual(result.deleted, []);
  assert.deepEqual(result.pruned, []);
});

test('a sweep validates its own dependencies', async () => {
  await assert.rejects(() => sweepProjectAssets({}), /requires a projectKey/);
  await assert.rejects(
    () => sweepProjectAssets({ projectKey: 'p1' }),
    /requires files.listDirectory/
  );
  await assert.rejects(
    () => sweepProjectAssets({ projectKey: 'p1', files: { listDirectory: async () => [] } }),
    /requires instances.listProjectMediaFileKeys/
  );
  await assert.rejects(
    () => sweepProjectAssets({
      projectKey: 'p1',
      files: { listDirectory: async () => [] },
      instances: { listProjectMediaFileKeys: async () => [] },
    }),
    /requires assets.listAssets/
  );
});
