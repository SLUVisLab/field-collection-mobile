import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLOB_CLEANUP_REASONS,
  planResourceBlobCleanup,
  sweepResourceBlobs,
} from '../../src/forms/resourceBlobCleanup.js';

// Mark and sweep by reachability. A reference count has to stay correct across
// a refresh that dies between writing the blob and recording the row;
// reachability is recomputed, so a failure just leaves work for the next sweep.

const blob = (digest, fileKey) => ({ digest, fileKey });

test('a blob a form revision still references is kept', () => {
  const plan = planResourceBlobCleanup({
    presentFileKeys: ['blobs/a', 'blobs/b'],
    blobs: [blob('sha256:a', 'blobs/a'), blob('sha256:b', 'blobs/b')],
    referencedDigests: ['sha256:a', 'sha256:b'],
  });
  assert.deepEqual(plan.deleteFiles, []);
  assert.deepEqual(plan.forgetDigests, []);
  assert.equal(plan.keepFiles.length, 2);
  assert.ok(plan.keepFiles.every((entry) => entry.reason === BLOB_CLEANUP_REASONS.REFERENCED));
});

test('a blob nothing references is deleted and forgotten', () => {
  // The ordinary case: an old form version was superseded and its unique
  // resource is now unreachable.
  const plan = planResourceBlobCleanup({
    presentFileKeys: ['blobs/a', 'blobs/old'],
    blobs: [blob('sha256:a', 'blobs/a'), blob('sha256:old', 'blobs/old')],
    referencedDigests: ['sha256:a'],
  });
  assert.deepEqual(plan.deleteFiles, [
    { fileKey: 'blobs/old', digest: 'sha256:old', reason: BLOB_CLEANUP_REASONS.UNREFERENCED },
  ]);
  assert.deepEqual(plan.forgetDigests, [
    { digest: 'sha256:old', reason: BLOB_CLEANUP_REASONS.UNREFERENCED },
  ]);
});

test('a blob shared by two form revisions survives losing one of them', () => {
  // The whole point of content addressing: reference.jpg is reachable from the
  // new revision even after the old one is gone.
  const plan = planResourceBlobCleanup({
    presentFileKeys: ['blobs/shared'],
    blobs: [blob('sha256:shared', 'blobs/shared')],
    referencedDigests: ['sha256:shared', 'sha256:shared'],
  });
  assert.deepEqual(plan.deleteFiles, []);
  assert.equal(plan.keepFiles[0].digest, 'sha256:shared');
});

test('a row whose bytes are gone is forgotten, never deleted', () => {
  const plan = planResourceBlobCleanup({
    presentFileKeys: [],
    blobs: [blob('sha256:ghost', 'blobs/ghost')],
    referencedDigests: ['sha256:ghost'],
  });
  assert.deepEqual(plan.deleteFiles, [], 'there is no file to delete');
  assert.deepEqual(plan.forgetDigests, [
    { digest: 'sha256:ghost', reason: BLOB_CLEANUP_REASONS.MISSING },
  ]);
});

test('an unledgered blob is kept unless orphan reclamation is asked for', () => {
  // A refresh that died after writing the blob and before recording it leaves
  // exactly this, and so does any older build that kept no ledger. Deleting it
  // by default would be data loss.
  const input = {
    presentFileKeys: ['blobs/mystery'],
    blobs: [],
    referencedDigests: [],
  };
  const kept = planResourceBlobCleanup(input);
  assert.deepEqual(kept.deleteFiles, []);
  assert.equal(kept.keepFiles[0].reason, BLOB_CLEANUP_REASONS.UNLEDGERED);

  const reclaimed = planResourceBlobCleanup({ ...input, reclaimOrphans: true });
  assert.equal(reclaimed.deleteFiles[0].fileKey, 'blobs/mystery');
});

test('the sweep deletes bytes before it forgets rows', async () => {
  // A failure part-way then leaves a row for a file that is gone, which the
  // next sweep forgets. The reverse strands bytes nothing records.
  const order = [];
  const result = await sweepResourceBlobs({
    projectKey: 'p1',
    blobDirectoryKey: 'projects/p1/resources/blobs',
    forms: {
      listResourceBlobs: async () => [blob('sha256:old', 'blobs/old')],
      listReferencedBlobDigests: async () => [],
      deleteResourceBlob: async (digest) => order.push(`forget:${digest}`),
    },
    files: {
      listDirectory: async () => ['blobs/old'],
      deleteFile: async (key) => order.push(`delete:${key}`),
    },
  });
  assert.deepEqual(order, ['delete:blobs/old', 'forget:sha256:old']);
  assert.equal(result.deleted.length, 1);
  assert.equal(result.forgotten.length, 1);
});

test('a sweep that cannot delete still returns, leaving the work for next time', async () => {
  const result = await sweepResourceBlobs({
    projectKey: 'p1',
    blobDirectoryKey: 'projects/p1/resources/blobs',
    forms: {
      listResourceBlobs: async () => [blob('sha256:old', 'blobs/old')],
      listReferencedBlobDigests: async () => [],
      deleteResourceBlob: async () => {},
    },
    files: {
      listDirectory: async () => ['blobs/old'],
      deleteFile: async () => {
        throw new Error('read-only filesystem');
      },
    },
  });
  assert.deepEqual(result.deleted, [], 'nothing was deleted');
  assert.equal(result.skipped, false, 'and the caller was not failed');
});

test('a sweep without its dependencies is a no-op, not a crash', async () => {
  assert.equal((await sweepResourceBlobs({})).skipped, true);
});
