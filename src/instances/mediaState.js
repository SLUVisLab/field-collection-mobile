/**
 * Render-free maintenance of a draft's in-memory media list.
 *
 * The instance **row** carries no media: the lifecycle service returns media
 * alongside it (`{ instance, media }`) and never nested inside it. Screens
 * therefore have to hold the list themselves, and `instance.media` silently
 * evaluating to `[]` is what emptied every collection field. See §22 of
 * docs/components-capabilities-ownership.md.
 *
 * Identity is the **filename**, never a repeat position or binding reference —
 * positions reindex on deletion. See
 * docs/repeat-media-identity-characterization.md.
 */

/**
 * Applies one attachment result to the list.
 *
 * @param {Array<{filename: string}>} rows current list
 * @param {{filename: string}|null} added the row `attachImageMedia` returned
 * @param {string|null} replacedFilename an attachment this capture retired
 * @returns {Array<{filename: string}>} a new list, ordered as storage orders it
 */
export const mergeMedia = (rows = [], added = null, replacedFilename = null) => {
  const retired = new Set();
  if (typeof replacedFilename === 'string' && replacedFilename.length > 0) {
    retired.add(replacedFilename);
  }
  const next = (rows ?? []).filter(
    (row) => typeof row?.filename === 'string' && row.filename.length > 0 && !retired.has(row.filename)
  );
  if (typeof added?.filename !== 'string' || added.filename.length === 0) return next;

  const at = next.findIndex((row) => row.filename === added.filename);
  if (at >= 0) {
    // Same filename means the same attachment was upserted; replace in place
    // rather than duplicating it.
    const replaced = [...next];
    replaced[at] = added;
    return replaced;
  }
  // `instances.listMedia` is ORDER BY filename ASC, so keeping that order means
  // the in-memory list matches what a reload would produce.
  return [...next, added].sort((left, right) => (left.filename < right.filename ? -1 : 1));
};

/** Drops the named attachments, whatever their position. */
export const withoutMedia = (rows = [], filenames = []) => {
  const gone = new Set(filenames ?? []);
  return (rows ?? []).filter((row) => !gone.has(row?.filename));
};
