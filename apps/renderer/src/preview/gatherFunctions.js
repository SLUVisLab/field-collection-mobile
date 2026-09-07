/**
 * The Gather Functions this renderer advertises to the Composer.
 *
 * Its own module so the contract test can assert **the set the app actually
 * ships** rather than a restatement of it. A test that maintains its own list
 * of expected functions passes happily while the renderer advertises none,
 * which is exactly the state this whole phase exists to correct.
 */
import { createHostFunctions, mergeFunctions } from '../../../../src/a2ui/hostFunctions.js';

import { previewCompleteComposition, previewPersistAsset } from './previewHost.js';
import { previewCapabilityFunctions } from './previewRuntime.js';

export const createGatherFunctions = () =>
  mergeFunctions(
    previewCapabilityFunctions(),
    createHostFunctions({
      persistAsset: previewPersistAsset,
      completeComposition: previewCompleteComposition,
    })
  );
