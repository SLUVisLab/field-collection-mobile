/**
 * The compatibility report, bound to this renderer's catalog and preview.
 *
 * The report itself is Gather domain logic (`src/authoring/compatibility.js`)
 * and knows nothing about a browser. This binds it to what the web authoring
 * layer has: the Model Catalog projection, the canonical Capability
 * definitions, and — optionally — what the preview ledger observed.
 *
 * The wrapper will consume this. No UI is built on it yet, deliberately.
 */
import { CAPABILITY_DEFINITIONS } from 'gather-capabilities';

import { compatibilityFor } from '../../../../src/authoring/compatibility.js';
import { previewModels } from './previewModels.js';

/** Preview evidence for a capability, from what actually ran in this page. */
export const previewEvidenceFor = ({ capabilityId, ledger = [] }) => {
  const functionName = capabilityId.replace(/\./g, '_');
  const entry = [...ledger].reverse().find((item) => item.name === functionName);
  if (!entry) return { attempted: false };
  return {
    attempted: true,
    fidelity: entry.fidelity,
    // Named so a reader can tell which backend produced the evidence — the
    // whole point when Phase 2 swaps this for onnxruntime-web.
    backend: entry.fidelity === 'real' ? 'renderer-browser' : 'renderer-preview-fixture',
    status: 'pass',
  };
};

export const previewCompatibilityFor = ({ capabilityId, modelRef = null, ledger = [] } = {}) =>
  compatibilityFor({
    capabilityId,
    modelRef,
    definitions: CAPABILITY_DEFINITIONS,
    models: previewModels,
    previewEvidence: previewEvidenceFor({ capabilityId, ledger }),
  });
