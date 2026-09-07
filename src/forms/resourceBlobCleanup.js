/**
 * Reclaiming form-resource blobs nothing references any more.
 *
 * **Mark and sweep, not reference counts.** A counter has to stay correct
 * across a refresh that fails half way through — after the blob is written but
 * before `form_resources` records it, or the reverse — and getting that wrong
 * either strands bytes or deletes bytes a form still needs. Reachability is
 * simply recomputed from the rows that exist, so a failed refresh leaves an
 * unreferenced blob that the next sweep collects. The number of form resources
 * on a field device is nowhere near large enough for the difference to cost
 * anything.
 *
 * The planner is pure so the dangerous half can be tested without a
 * filesystem, exactly as `instances/assetCleanup.js` does.
 *
 * See docs/reference/architecture/form-refresh-cost.md.
 */

export const BLOB_CLEANUP_REASONS = Object.freeze({
  REFERENCED: 'referenced',
  UNREFERENCED: 'unreferenced',
  MISSING: 'missing',
  UNLEDGERED: 'unledgered',
});

const keyOf = (value) => (typeof value === 'string' ? value : value?.fileKey ?? null);

/**
 * What to delete, keep, and forget.
 *
 * ```text
 * referenced by a form_resources row  → keep
 * recorded but referenced by nothing  → delete the bytes, forget the row
 * recorded but absent from disk       → forget the row; never a file delete
 * on disk with no ledger row          → UNLEDGERED, kept unless reclaimOrphans
 * ```
 *
 * `reclaimOrphans` defaults to **false** for the same reason it does for
 * project assets: a blob written by a refresh that died before recording it is
 * indistinguishable from one written by a version of this code that did not
 * keep a ledger, and deleting the latter would be data loss.
 *
 * @param {{
 *   presentFileKeys?: Array<string>,
 *   blobs?: Array<{ digest: string, fileKey: string }>,
 *   referencedDigests?: Array<string>,
 *   reclaimOrphans?: boolean,
 * }} input
 */
export const planResourceBlobCleanup = ({
  presentFileKeys = [],
  blobs = [],
  referencedDigests = [],
  reclaimOrphans = false,
} = {}) => {
  const present = new Set((presentFileKeys ?? []).map(keyOf).filter(Boolean));
  const referenced = new Set((referencedDigests ?? []).filter(Boolean));
  const ledgered = new Set();

  const deleteFiles = [];
  const keepFiles = [];
  const forgetDigests = [];

  for (const blob of blobs ?? []) {
    const fileKey = keyOf(blob);
    if (!blob?.digest || !fileKey) continue;
    ledgered.add(fileKey);

    if (!present.has(fileKey)) {
      // The row outlived its bytes. Forget it; there is nothing to delete.
      forgetDigests.push({ digest: blob.digest, reason: BLOB_CLEANUP_REASONS.MISSING });
      continue;
    }
    if (referenced.has(blob.digest)) {
      keepFiles.push({ fileKey, digest: blob.digest, reason: BLOB_CLEANUP_REASONS.REFERENCED });
      continue;
    }
    deleteFiles.push({ fileKey, digest: blob.digest, reason: BLOB_CLEANUP_REASONS.UNREFERENCED });
    forgetDigests.push({ digest: blob.digest, reason: BLOB_CLEANUP_REASONS.UNREFERENCED });
  }

  for (const fileKey of [...present].sort()) {
    if (ledgered.has(fileKey)) continue;
    (reclaimOrphans ? deleteFiles : keepFiles).push({
      fileKey,
      digest: null,
      reason: BLOB_CLEANUP_REASONS.UNLEDGERED,
    });
  }

  return { deleteFiles, keepFiles, forgetDigests };
};

/**
 * Enumerates, plans, and executes.
 *
 * Bytes go before rows, as in `assetCleanup`: a failure part-way leaves a row
 * for a file that is gone, which the next sweep forgets. The reverse would
 * strand bytes that nothing records.
 */
export const sweepResourceBlobs = async ({
  projectKey,
  forms,
  files,
  blobDirectoryKey,
  reclaimOrphans = false,
} = {}) => {
  if (!forms || !files || !blobDirectoryKey) {
    return { deleted: [], kept: [], forgotten: [], skipped: true };
  }

  const [presentFileKeys, blobs, referencedDigests] = await Promise.all([
    files.listDirectory ? files.listDirectory(blobDirectoryKey) : [],
    forms.listResourceBlobs(),
    forms.listReferencedBlobDigests(),
  ]);

  const plan = planResourceBlobCleanup({
    presentFileKeys,
    blobs,
    referencedDigests,
    reclaimOrphans,
  });

  const deleted = [];
  for (const entry of plan.deleteFiles) {
    try {
      await files.deleteFile(entry.fileKey);
      deleted.push(entry);
    } catch {
      // A blob we could not delete stays referenced by nothing and is simply
      // collected next time. Cleanup must never fail the caller.
    }
  }
  const forgotten = [];
  for (const entry of plan.forgetDigests) {
    try {
      await forms.deleteResourceBlob(entry.digest);
      forgotten.push(entry);
    } catch {
      // Same bias: a stale row costs nothing until the next sweep.
    }
  }

  return { deleted, kept: plan.keepFiles, forgotten, projectKey, skipped: false };
};
