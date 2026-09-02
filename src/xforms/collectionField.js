/**
 * Render-free logic for the Gather-enhanced **multi-image collection field**.
 *
 * The repeat *is* the data model; `ImageAsset[]` is a value view over it — see
 * docs/b-standard-field-conventions.md §4. Nothing here touches XPath, the
 * engine, or storage; the control/adapter owns those.
 *
 * ```text
 * /data/photos[1]/photo   ↕
 * /data/photos[2]/photo   ↕   repeat<ImageAsset>   ↔   ImageAsset[]
 * /data/photos[3]/photo   ↕
 * ```
 */

export const MULTI_IMAGE_APPEARANCE = 'gather-multi-image';

const numericToken = (appearances, key) => {
  const prefix = `${key}=`;
  for (const token of appearances) {
    if (typeof token !== 'string' || !token.startsWith(prefix)) continue;
    const parsed = Number.parseInt(token.slice(prefix.length), 10);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
};

/**
 * Reads the collection configuration off a repeat-range node's appearances.
 *
 * Cardinality is carried as `key=value` appearance parameters rather than a
 * controlled (`jr:count`) repeat: the interaction is `0..N` add/remove, and
 * exact-four is simply `min=4 max=4`. Verified to survive the engine verbatim
 * (experiments/appearance-parameters/).
 *
 * @param {string[]|Iterable<string>} appearances
 * @returns {{ enabled: boolean, minItems: number, maxItems: number|null }}
 */
export const multiImageConfigFrom = (appearances) => {
  const tokens = appearances == null ? [] : Array.from(appearances, (token) => String(token));
  if (!tokens.includes(MULTI_IMAGE_APPEARANCE)) {
    return { enabled: false, minItems: 0, maxItems: null };
  }
  const min = numericToken(tokens, 'min');
  const max = numericToken(tokens, 'max');
  const minItems = min ?? 0;
  // A max below the min would make the field unsatisfiable; treat it as absent
  // rather than trapping the researcher with an uncompletable control.
  const maxItems = max !== null && max >= Math.max(minItems, 1) ? max : null;
  return { enabled: true, minItems, maxItems };
};

/** `/data/photos[2]` → `2`; null when the reference carries no position. */
export const instancePositionOf = (reference) => {
  const match = typeof reference === 'string' ? reference.match(/\[(\d+)\]$/) : null;
  return match ? Number.parseInt(match[1], 10) : null;
};

/**
 * Maps each repeat instance to its **binary child**, as the engine reports it.
 *
 * The child's name belongs to the form author (`photo`, `image`, `frame`, …),
 * so it is always read from the engine and never assumed. This is the single
 * source of truth for "which node holds this instance's image" — both
 * projecting the collection and resolving the newest slot after an add go
 * through it, so the two can never disagree.
 *
 * @param {{ repeatReference: string, nodesByReference: Record<string, { valueType?: string }> }} input
 * @returns {Map<string, string>} instance reference -> binary child reference
 */
export const binaryChildrenOf = ({ repeatReference, nodesByReference } = {}) => {
  const byInstance = new Map();
  if (typeof repeatReference !== 'string' || repeatReference.length === 0) return byInstance;
  const prefix = `${repeatReference}[`;
  for (const [reference, entry] of Object.entries(nodesByReference ?? {})) {
    if (!reference.startsWith(prefix) || entry?.valueType !== 'binary') continue;
    const cut = reference.lastIndexOf('/');
    if (cut <= 0) continue;
    const instanceReference = reference.slice(0, cut);
    if (instancePositionOf(instanceReference) === null) continue;
    // First wins, so a nested binary deeper in the instance cannot shadow the
    // instance's own child.
    if (!byInstance.has(instanceReference)) byInstance.set(instanceReference, reference);
  }
  return byInstance;
};

/**
 * The binary child of the highest-positioned instance — the slot a fresh
 * `addInstances()` just created.
 */
export const newestBinaryChild = (byInstance) => {
  let best = null;
  let bestPosition = -1;
  for (const [instanceReference, reference] of byInstance ?? []) {
    const position = instancePositionOf(instanceReference);
    if (position !== null && position > bestPosition) {
      bestPosition = position;
      best = reference;
    }
  }
  return best;
};

/** Orders repeat-instance references by their position, not lexically. */
export const orderedInstanceReferences = (references) =>
  [...(references ?? [])]
    .filter((reference) => instancePositionOf(reference) !== null)
    .sort((left, right) => instancePositionOf(left) - instancePositionOf(right));

/**
 * Projects the repeat into the `ImageAsset[]`-shaped value the Component reads.
 *
 * The XForms data model holds *filenames*; the durable asset lives in the media
 * table. Each item is duck-typed for display (`MediaGallery` reads `uri`,
 * `mimeType`, …) and carries `filename` plus its owning `reference` so the
 * adapter can act on the right repeat instance.
 *
 * An instance whose image node is empty, or whose filename has no media row,
 * is skipped — a half-written instance is not a collection item.
 *
 * `binaryChildOf` is **required**, and deliberately has no default. An earlier
 * version defaulted the child's name to `'photo'`, which silently projected an
 * empty collection for every form that named it anything else — captures
 * persisted into the XML but vanished from the UI. There is no safe guess here:
 * the name is the form author's, so the engine has to supply it. Build the
 * lookup with {@link binaryChildrenOf}.
 *
 * @param {{
 *   instanceReferences: string[],
 *   binaryChildOf: (instanceReference: string) => string|null,
 *   valueAt: (reference: string) => string,
 *   media: Array<{ filename: string, contentType?: string, fileKey: string }>,
 *   uriFor: (fileKey: string) => string|null,
 * }} input
 */
export const collectionItemsFrom = ({
  instanceReferences,
  binaryChildOf,
  valueAt,
  media = [],
  uriFor,
} = {}) => {
  if (typeof binaryChildOf !== 'function') {
    throw new TypeError('collectionItemsFrom requires binaryChildOf; see binaryChildrenOf.');
  }
  const byFilename = new Map((media ?? []).map((row) => [row.filename, row]));
  const items = [];
  for (const instanceReference of orderedInstanceReferences(instanceReferences)) {
    const reference = binaryChildOf(instanceReference);
    if (typeof reference !== 'string' || reference.length === 0) continue;
    const filename = valueAt?.(reference);
    if (typeof filename !== 'string' || filename.length === 0) continue;
    const row = byFilename.get(filename);
    if (!row) continue;
    items.push({
      assetId: filename,
      filename,
      reference,
      instanceReference,
      position: instancePositionOf(instanceReference),
      uri: uriFor?.(row.fileKey) ?? null,
      path: row.fileKey,
      mimeType: row.contentType ?? null,
    });
  }
  return items;
};

/**
 * Filenames that were referenced before an edit and are not after it — the
 * media rows and bytes a removal orphans.
 *
 * Computed from *referenced* filenames rather than from positions, because
 * repeat positions reindex on deletion and are never a durable identity. See
 * docs/repeat-media-identity-characterization.md.
 */
export const orphanedFilenames = ({ before = [], after = [] } = {}) => {
  const kept = new Set(after.map((item) => (typeof item === 'string' ? item : item?.filename)));
  const seen = new Set();
  const orphans = [];
  for (const entry of before) {
    const filename = typeof entry === 'string' ? entry : entry?.filename;
    if (typeof filename !== 'string' || filename.length === 0) continue;
    if (kept.has(filename) || seen.has(filename)) continue;
    seen.add(filename);
    orphans.push(filename);
  }
  return orphans;
};
