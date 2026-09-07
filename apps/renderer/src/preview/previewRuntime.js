/**
 * The renderer's **preview runtime** — what makes Gather Capabilities real
 * authoring resources in the Composer.
 *
 * Until now `apps/renderer` advertised its Components and only upstream's Basic
 * Catalog functions, so the Composer's agent could not author `image_segment`
 * at all: it did not know the function existed. Everything needed already
 * existed in `packages/` and `src/`; none of it was wired here.
 *
 * ```text
 * gather-capabilities definitions            canonical, shared with the app
 *          ↓  createCapabilityRuntime        canonical semantics, injected backend
 * preview executors (this file)              browser-only, honest about fidelity
 *          ↓  capabilityFunctions
 * A2UI Catalog.functions  →  GET_CATALOG  →  upstream Composer agent
 * ```
 *
 * This is **not** the mobile `GatherProvider`. It shares the capability layer
 * and nothing else: no SQLite, no project, no model store, no native runtime.
 * What it swaps is only the inference backend and the model resolver.
 */
import {
  CAPABILITY_DEFINITIONS,
  createCapabilityRuntime,
} from 'gather-capabilities';

import { createModelExecutor } from '../../../../src/compute/runtime/modelExecutor.js';
import { capabilityFunctions } from '../../../../src/a2ui/capabilityFunctions.js';
import { authoringInputSchemaFor } from './authoringSchema.js';
import { recordPreviewExecution } from './previewLedger.js';
import { measureMaskCoverage, setPreviewUriResolver } from './previewImaging.js';
import { previewModels, resolvePreviewModel } from './previewModels.js';
import { createWebFiles } from './web/webFiles.js';
import { createWebImageAdapter } from './web/webImageAdapter.js';
import {
  createWebModelProvider,
  createWebModelResolver,
  createWebModelStore,
} from './web/webModelProvider.js';
import { createInstalledFirstProvider, installPackage } from './web/packageInstall.js';
import { createWebOnnxRuntime, ONNX_RUNTIME_WEB } from './web/webOnnxRuntime.js';

/**
 * The Capabilities this preview backs. Kept explicit rather than "whatever the
 * runtime map happens to contain", because advertising a Function to the
 * Composer that cannot execute is worse than not advertising it — the author
 * finds out by pressing a button that does nothing.
 */
export const ADVERTISED_CAPABILITIES = Object.freeze([
  'image.segment',
  'image.classify',
  'measure.area',
]);

/**
 * Real segmentation, in the browser.
 *
 * `createModelExecutor` is reused **verbatim** from the app — the same
 * preprocessing, the same `rgbToTensor`, the same `binaryMask`, the same
 * ModelPackage-driven steps. Only the four injected seams differ, which is what
 * the executor's shape always allowed:
 *
 * ```text
 * imageAdapter   OpenCV over RN files   →  canvas over blobs
 * onnxRuntime    onnxruntime-react-native → onnxruntime-web
 * modelStore     device model store     →  content-addressed static assets
 * files          expo-file-system       →  a Map for the session
 * ```
 *
 * There is no simulated segmentation any more. A failure here is a failure, not
 * a quiet fall back to a drawn ellipse — a preview that invented a mask when
 * inference broke would be worse than no preview.
 */
export const previewFiles = createWebFiles();
// Masks are written to the session store and read back by URI.
setPreviewUriResolver((uri) => previewFiles.resolveUrl(uri));
// Installed packages answer before the distribution's own static assets, so a
// packaged Tool runs the revision it was frozen against rather than whatever
// this renderer happens to ship.
const webProvider = createInstalledFirstProvider({ fallback: createWebModelProvider() });
const webExecutor = createModelExecutor({
  modelStore: createWebModelStore({ provider: webProvider }),
  onnxRuntime: createWebOnnxRuntime(),
  imageAdapter: createWebImageAdapter({ files: previewFiles }),
  files: previewFiles,
  newAssetId: () => `preview-${Math.random().toString(36).slice(2, 12)}`,
  runtimeAdapter: `${ONNX_RUNTIME_WEB.id}@${ONNX_RUNTIME_WEB.version}`,
});

const previewSegment = async ({ image, model }) => {
  const startedAt = performance.now();
  const result = await webExecutor.segment({ projectKey: 'preview', image, model });
  recordPreviewExecution({
    name: 'image_segment',
    fidelity: 'real',
    detail:
      `${model?.identity?.id ?? 'model'} on ${ONNX_RUNTIME_WEB.id}@${ONNX_RUNTIME_WEB.version} — ` +
      `${Math.round(performance.now() - startedAt)}ms`,
  });
  return result;
};

const previewClassify = async ({ image, model }) => {
  recordPreviewExecution({
    name: 'image_classify',
    fidelity: 'simulated',
    detail: `${model?.displayName ?? 'model'} — fixed labels, no inference`,
  });
  return {
    ranked: [
      { label: 'preview specimen', score: 0.82 },
      { label: 'preview background', score: 0.11 },
    ],
  };
};

/**
 * Mask measurements are **real**: actual pixels of the actual mask image, the
 * same quantity the device reports. The mask it measures is simulated, which
 * the ledger records separately — two different claims, and collapsing them is
 * how a preview starts lying.
 */
const previewMeasurementAdapter = {
  maskMeasurements: async (mask) => {
    const coverage = await measureMaskCoverage({ uri: mask.uri });
    recordPreviewExecution({
      name: 'measure_area',
      fidelity: 'real',
      detail: `${coverage.covered.toLocaleString()} px of ${(coverage.width * coverage.height).toLocaleString()}`,
    });
    return {
      area: { value: coverage.covered, unit: 'px2' },
      perimeter: null,
      boundingBox: coverage.boundingBox,
      centroid: coverage.centroid,
    };
  },
  imageMeasurements: async () => {
    throw new Error(
      'measure.color and measure.sharpness have no preview implementation, so they are not advertised.'
    );
  },
};

/**
 * Builds the Gather capability Functions this renderer advertises.
 *
 * Restricting the canonical runtime map to {@link ADVERTISED_CAPABILITIES}
 * rather than passing it whole is what keeps the advertised set and the
 * executable set the same thing.
 */
export const previewCapabilityFunctions = () => {
  const full = createCapabilityRuntime({
    segmentExecute: previewSegment,
    classifyExecute: previewClassify,
    measurementAdapter: previewMeasurementAdapter,
    // Segmentation resolves to a real ModelPackage with real bytes; anything
    // else still uses the catalog projection, which is all a fixture needs.
    resolveModel: async (input) =>
      input.capabilityId === 'image.segment'
        ? createWebModelResolver({ provider: webProvider, models: previewModels })(input)
        : resolvePreviewModel(input),
  });

  const missing = ADVERTISED_CAPABILITIES.filter((id) => typeof full[id] !== 'function');
  if (missing.length > 0) {
    throw new Error(
      `The preview runtime cannot back ${missing.join(', ')}. ` +
        'Either implement them or remove them from ADVERTISED_CAPABILITIES — ' +
        'a Function the Composer can author but cannot run is the failure this check exists to prevent.'
    );
  }

  const runtime = Object.fromEntries(ADVERTISED_CAPABILITIES.map((id) => [id, full[id]]));

  // The authoring projection is applied here, to a copy — the canonical
  // definitions keep their portable schemas, and a capability with no
  // compatible model in this distribution is passed through untouched.
  const definitions = CAPABILITY_DEFINITIONS.map((definition) => {
    const input = authoringInputSchemaFor({ definition, models: previewModels });
    return input === definition.input ? definition : { ...definition, input };
  });

  return capabilityFunctions({ definitions, runtime });
};

export { installPackage, previewModels, webProvider };
