/**
 * Render-free cleanup planning for project assets.
 *
 * Deciding what to delete is the dangerous half of cleanup, so it lives here as
 * a pure function over three inputs — what is on disk, what submission still
 * needs, and what the ledger says — and returns a plan that explains itself.
 * Nothing here touches the filesystem or the database.
 *
 * Conventions in docs/b-custom-composition-conventions.md §4.
 */

export const CLEANUP_REASONS = Object.freeze({
  ATTACHMENT: 'attachment',
  RETAINED: 'retained',
  IN_USE: 'in-use',
  RELEASED: 'released',
  UNLEDGERED: 'unledgered',
  MISSING: 'missing',
});

const keyOf = (entry) => (typeof entry === 'string' ? entry : entry?.fileKey);

/**
 * Plans a sweep.
 *
 * Rules, in precedence order:
 *
 * 1. **A form attachment is never deleted**, whatever the ledger says. This is
 *    what stops `retention: discard` on a submitted output from meaning
 *    "delete immediately after compute" — the bytes have to survive the
 *    submission handoff.
 * 2. `retention: keep` → kept. The deliberately-local asset.
 * 3. `retention: discard` **and released** → deleted. Released is the
 *    producer saying the bytes are no longer needed.
 * 4. `retention: discard` and **not** released → kept. Still in use.
 * 5. On disk but in neither attachments nor ledger → **unledgered**. Kept
 *    unless `reclaimOrphans` is set, because installs that predate the ledger
 *    have real captures with no row, and deleting those would be data loss.
 * 6. In the ledger but not on disk → prune the row. Never a file delete.
 *
 * @param {{
 *   presentFileKeys?: Array<string>,
 *   attachmentFileKeys?: Array<string|{fileKey: string}>,
 *   ledger?: Array<{fileKey: string, retention: string, releasedAt?: string|null}>,
 *   reclaimOrphans?: boolean,
 * }} input
 * @returns {{
 *   deleteFiles: Array<{fileKey: string, reason: string}>,
 *   keepFiles: Array<{fileKey: string, reason: string}>,
 *   pruneRows: Array<{fileKey: string, reason: string}>,
 * }}
 */
export const planAssetCleanup = ({
  presentFileKeys = [],
  attachmentFileKeys = [],
  ledger = [],
  reclaimOrphans = false,
} = {}) => {
  const present = new Set((presentFileKeys ?? []).map(keyOf).filter(Boolean));
  const attachments = new Set((attachmentFileKeys ?? []).map(keyOf).filter(Boolean));
  const rows = new Map();
  for (const row of ledger ?? []) {
    const fileKey = keyOf(row);
    if (fileKey) rows.set(fileKey, row);
  }

  const deleteFiles = [];
  const keepFiles = [];
  const pruneRows = [];

  for (const fileKey of [...present].sort()) {
    if (attachments.has(fileKey)) {
      keepFiles.push({ fileKey, reason: CLEANUP_REASONS.ATTACHMENT });
      continue;
    }
    const row = rows.get(fileKey);
    if (!row) {
      (reclaimOrphans ? deleteFiles : keepFiles).push({
        fileKey,
        reason: CLEANUP_REASONS.UNLEDGERED,
      });
      continue;
    }
    if (row.retention === 'discard') {
      if (row.releasedAt) {
        deleteFiles.push({ fileKey, reason: CLEANUP_REASONS.RELEASED });
      } else {
        keepFiles.push({ fileKey, reason: CLEANUP_REASONS.IN_USE });
      }
      continue;
    }
    // Anything not explicitly `discard` is kept. An unrecognised retention
    // value must not be read as permission to delete.
    keepFiles.push({ fileKey, reason: CLEANUP_REASONS.RETAINED });
  }

  for (const fileKey of [...rows.keys()].sort()) {
    if (!present.has(fileKey)) {
      pruneRows.push({ fileKey, reason: CLEANUP_REASONS.MISSING });
    }
  }
  // A file being deleted takes its ledger row with it.
  for (const entry of deleteFiles) {
    if (rows.has(entry.fileKey)) pruneRows.push({ fileKey: entry.fileKey, reason: entry.reason });
  }

  return { deleteFiles, keepFiles, pruneRows };
};

/**
 * Executes a plan, with the filesystem and ledger injected.
 *
 * Bytes go first, then the row: a failure part-way leaves a ledger row for a
 * file that is already gone, which the next sweep prunes as `missing`. The
 * reverse order would strand bytes with nothing recording them, which is the
 * unreclaimable case.
 */
export const runAssetCleanup = async ({ plan, files, assets } = {}) => {
  if (!plan) throw new Error('runAssetCleanup requires a plan.');
  if (typeof files?.deleteFile !== 'function') {
    throw new Error('runAssetCleanup requires files.deleteFile.');
  }
  if (typeof assets?.deleteAsset !== 'function') {
    throw new Error('runAssetCleanup requires assets.deleteAsset.');
  }

  const deleted = [];
  const failed = [];
  for (const entry of plan.deleteFiles ?? []) {
    try {
      await files.deleteFile(entry.fileKey);
      deleted.push(entry.fileKey);
    } catch (error) {
      failed.push({ fileKey: entry.fileKey, message: error?.message ?? String(error) });
    }
  }

  const pruned = [];
  const gone = new Set(deleted);
  for (const entry of plan.pruneRows ?? []) {
    // Only prune a row whose bytes are actually absent — either this sweep
    // deleted them, or they were already missing.
    const removable = gone.has(entry.fileKey) || entry.reason === CLEANUP_REASONS.MISSING;
    if (!removable) continue;
    try {
      await assets.deleteAsset(entry.fileKey);
      pruned.push(entry.fileKey);
    } catch (error) {
      failed.push({ fileKey: entry.fileKey, message: error?.message ?? String(error) });
    }
  }

  return { deleted, pruned, failed };
};

/**
 * A full sweep of one project: enumerate, plan, execute.
 *
 * Composed rather than monolithic so the dangerous part stays the pure planner
 * above. Everything here is injected, so this is exercised without a device.
 *
 * `reclaimOrphans` defaults to **false**: a file with no ledger row is kept.
 * Installs predate the ledger, and `persistScientificCapture` wrote real
 * captures into project media for a long time without recording them, so
 * treating unknown files as garbage would be data loss. Pass `true` only for a
 * project whose assets are known to be fully ledgered.
 */
export const sweepProjectAssets = async ({
  projectKey,
  mediaDirectoryKey,
  files,
  instances,
  assets,
  reclaimOrphans = false,
} = {}) => {
  if (typeof projectKey !== 'string' || projectKey.length === 0) {
    throw new Error('sweepProjectAssets requires a projectKey.');
  }
  if (typeof files?.listDirectory !== 'function') {
    throw new Error('sweepProjectAssets requires files.listDirectory.');
  }
  if (typeof instances?.listProjectMediaFileKeys !== 'function') {
    throw new Error('sweepProjectAssets requires instances.listProjectMediaFileKeys.');
  }
  if (typeof assets?.listAssets !== 'function') {
    throw new Error('sweepProjectAssets requires assets.listAssets.');
  }

  const plan = planAssetCleanup({
    presentFileKeys: await files.listDirectory(mediaDirectoryKey),
    attachmentFileKeys: await instances.listProjectMediaFileKeys(projectKey),
    ledger: await assets.listAssets(projectKey),
    reclaimOrphans,
  });
  return { plan, ...(await runAssetCleanup({ plan, files, assets })) };
};
