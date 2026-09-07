/**
 * The portable model subsystem.
 *
 * It answers, and only answers:
 *
 * ```text
 * what model is this?          ModelPackage / ModelRef
 * what version is it?          identity + content revision
 * is it valid?                 validateModelPackage
 * is it available locally?     ensureModelAvailable
 * how do I resolve a verified  createModelStore().resolve
 *   local artifact?
 * ```
 *
 * What it deliberately does **not** own:
 *
 * - **Semantic inference.** `image.segment` and friends are capabilities; this
 *   package knows nothing about what a model *means*.
 * - **Execution.** No ONNX Runtime, no OpenCV, no tensors. The store hands back
 *   a verified path; running it is the compute layer's problem.
 * - **Platform.** No React Native, no Expo, no native objects. The filesystem
 *   is injected, so loading bundled bytes stays an app-side adapter behind this
 *   contract (`src/compute/models/bundledModelInstaller.js`).
 * - **Which models an app ships.** That is app policy and app data.
 */
export { ModelError } from './errors.js';
export {
  TASK_PROFILES,
  createModelRef,
  modelArtifactDigestFor,
  modelRevisionFor,
  validateModelPackage,
} from './modelPackage.js';
export { createModelStore } from './modelStore.js';
export { ensureModelAvailable } from './modelAvailability.js';
