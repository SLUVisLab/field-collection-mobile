/**
 * The identity of a **working asset**, minted in one place.
 *
 * A persisted capture is referred to by four things, and they have to agree:
 *
 * ```text
 * project_assets.asset_id        the ledger row
 * ImageAsset.assetId             what the composition receives
 * <assetId>.jpg                  the file on disk
 * receipt.outputs.<x>.assetId    the provenance record
 * ```
 *
 * They did not. `persistScientificCapture` minted an id to build the storage
 * key and record the ledger row, and `imageAssetService.persistCapture` minted
 * a *second* one for the object it returned — so the ledger said
 * `image-…633` while the receipt said `image-…694` for the same bytes. Only the
 * fileKey was shared, which is why nothing visibly broke and why it survived
 * until a device run printed both.
 *
 * Minting the pair together makes the agreement structural instead of a
 * property of three call sites happening to use the same variable. The ODK
 * `instance_media` row a promotion creates is a *different* record with its own
 * filename, and deliberately so — one working asset, one Gather identity, one
 * submission attachment.
 *
 * See docs/b-custom-composition-conventions.md §4b.
 */

/**
 * @param {{ projectKey: string, media: (projectKey: string, name: string) => string, newId?: () => string }} input
 * @returns {{ assetId: string, fileKey: string }}
 */
export const workingAssetIdentity = ({ projectKey, media, newId } = {}) => {
  if (typeof media !== 'function') {
    throw new Error('A working asset identity needs the project media path builder.');
  }
  const mint =
    typeof newId === 'function'
      ? newId
      : () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const assetId = `image-${mint()}`;
  // The file is named for the asset, so the name on disk can never drift from
  // the id the ledger and the receipt carry.
  return { assetId, fileKey: media(projectKey, `${assetId}.jpg`) };
};
