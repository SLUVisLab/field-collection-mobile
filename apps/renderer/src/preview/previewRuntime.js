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
  assertRuntimeCovers,
  CAPABILITY_DEFINITIONS,
  createCapabilityRuntime,
} from 'gather-capabilities';

import { createModelExecutor } from '../../../../src/compute/runtime/modelExecutor.js';
import { capabilityFunctions } from '../../../../src/a2ui/capabilityFunctions.js';
import { authoringInputSchemaFor } from './authoringSchema.js';
import { recordPreviewExecution } from './previewLedger.js';
import { setPreviewUriResolver } from './previewImaging.js';
import { previewModels, resolvePreviewModel } from './previewModels.js';
import { createWebFiles } from './web/webFiles.js';
import { createWebImageAdapter } from './web/webImageAdapter.js';
import {
  createWebModelProvider,
  createWebModelResolver,
  createWebModelStore,
} from './web/webModelProvider.js';
import { createInstalledFirstProvider, installPackage } from './web/packageInstall.js';
import { createOpenCvWebMeasurementAdapter } from './web/openCvWebMeasurementAdapter.js';
import { createWebOnnxRuntime, ONNX_RUNTIME_WEB } from './web/webOnnxRuntime.js';

/**
 * The Capabilities this preview backs: **all of them**.
 *
 * This was an explicit three-item allowlist, which quietly made the authoring
 * vocabulary "whatever the browser happened to support" — five of Gather's
 * eight Capabilities executed on the device and could not be authored in the
 * Composer, and nothing said so. The rule is the other way round now: a
 * Capability is authorable only if both runtimes execute it, so the browser
 * implements the contract rather than the catalog shrinking to fit.
 *
 * Derived from the definitions, so adding one to CAPABILITY_DEFINITIONS without
 * a browser implementation fails the check below instead of silently vanishing
 * from the Composer.
 */
export const ADVERTISED_CAPABILITIES = Object.freeze(
  CAPABILITY_DEFINITIONS.map((definition) => definition.id)
);

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
 * Measurements are **real**, and are OpenCV's — the same library and the same
 * version the device uses (4.12.0), through the build in `vendor/opencv` instead of
 * `react-native-fast-opencv`. The mask being measured may have come from a
 * sample image, which the ledger records separately: two different claims, and
 * collapsing them is how a preview starts lying.
 *
 * This previously returned a null perimeter and threw for colour and sharpness,
 * which is what kept five Capabilities out of the Composer.
 */
const openCvAdapter = createOpenCvWebMeasurementAdapter({
  resolveUri: (uri) => previewFiles.resolveUrl(uri),
});

const previewMeasurementAdapter = {
  maskMeasurements: async (mask) => {
    const measurements = await openCvAdapter.maskMeasurements(mask);
    recordPreviewExecution({
      name: 'measure_mask',
      fidelity: 'real',
      detail:
        `${measurements.area.value.toLocaleString()} px² · ` +
        `perimeter ${measurements.perimeter.value.toFixed(1)} px — opencv.js 4.12.0`,
    });
    return measurements;
  },
  imageMeasurements: async (image, mask) => {
    const measurements = await openCvAdapter.imageMeasurements(image, mask);
    recordPreviewExecution({
      name: 'measure_image',
      fidelity: 'real',
      detail: `sharpness ${measurements.sharpness.score.toFixed(1)} — opencv.js 4.12.0`,
    });
    return measurements;
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

  // Parity, asserted where the runtime is built. The browser is the host that
  // has historically lagged, so this is the check that would have caught five
  // Capabilities being quietly unauthorable.
  assertRuntimeCovers({ runtime: full, host: 'browser preview' });

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
