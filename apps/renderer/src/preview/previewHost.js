/**
 * Host Functions with **preview semantics, not faked XForms semantics**.
 *
 * The Composer preview has no XForms instance, no submission and no device. So
 * these do the honest half of what the app does and say so, rather than
 * reporting success for a persistence that did not happen. Where the outputs
 * would land in a form is a question for the wrapper's Validate panel, which
 * has the form context; it is not something the renderer should invent.
 */
import { digestBytes } from 'gather-hashing';

import { describeImage } from './previewImaging.js';
import { recordPreviewExecution } from './previewLedger.js';

const bytesOf = async (uri) => {
  const response = await fetch(uri);
  return new Uint8Array(await response.arrayBuffer());
};

/**
 * A browser-local preview `ImageAsset`. Real bytes and a real content digest —
 * so a composition's downstream steps operate on the same identity the device
 * would give them — held in the page and nowhere else.
 */
export const previewPersistAsset = async ({ capture }) => {
  const bytes = await bytesOf(capture.uri);
  const sha256 = digestBytes(bytes);
  const { width, height } = await describeImage(capture.uri);
  const assetId = `preview-${sha256.slice(7, 19)}`;
  recordPreviewExecution({
    name: 'gather_persistAsset',
    fidelity: 'preview',
    detail: `${assetId} held in this page only — not written to a device`,
  });
  return {
    assetId,
    uri: capture.uri,
    path: `preview/${assetId}.jpg`,
    width,
    height,
    mimeType: capture.contentType ?? 'image/jpeg',
    sha256,
    orientation: null,
    capturedAt: new Date().toISOString(),
  };
};

/**
 * Finalizes the preview's declared outputs. It validates that they are present
 * and reports completion; it does **not** claim a submission, because there is
 * no form here to submit to.
 */
export const previewCompleteComposition = async ({ outputs }) => {
  const present = Object.entries(outputs ?? {}).filter(([, value]) => value != null);
  const absent = Object.keys(outputs ?? {}).filter((key) => outputs[key] == null);
  recordPreviewExecution({
    name: 'gather_completeComposition',
    fidelity: 'preview',
    detail:
      `${present.length} output(s) resolved` +
      (absent.length ? `, ${absent.length} absent: ${absent.join(', ')}` : '') +
      ' — preview only, nothing was submitted',
  });
  return {
    previewComplete: true,
    outputs: Object.fromEntries(present),
    absent,
  };
};
