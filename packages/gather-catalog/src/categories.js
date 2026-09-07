/**
 * Gather's component taxonomy — **Gather-owned**, and deliberately so.
 *
 * An authoring environment groups components to make them findable. Upstream
 * A2UI Composer does that by keyword-matching the component *key* against a
 * fixed rule list and falling back to "Other", which for Gather produced a
 * collision rather than a taxonomy: `ImageOverlay` and `MultiImageCapture`
 * landed under "Content" because their names contain "image", and everything
 * else landed under "Other".
 *
 * The fix is not to rename components until they match somebody else's
 * keywords, and not to encode "CameraView goes under Capture" inside an Angular
 * service. It is for Gather to state its own taxonomy here, and for the
 * authoring host to honour whatever a catalog declares.
 *
 * Categories are a **presentation** concern. Nothing in the runtime reads them,
 * a component with no category is still a valid component, and adding one never
 * changes what a Tool does.
 */
import { GATHER_COMPONENT_IDS } from './identifiers.js';

/** Ordered: an authoring host may use this to lay categories out predictably. */
export const GATHER_COMPONENT_CATEGORIES = Object.freeze([
  'Capture',
  'Media',
  'Flow',
  'Results',
]);

const BY_COMPONENT = Object.freeze({
  [GATHER_COMPONENT_IDS.capture]: 'Capture',
  [GATHER_COMPONENT_IDS.cameraView]: 'Capture',
  [GATHER_COMPONENT_IDS.multiImageCapture]: 'Capture',
  [GATHER_COMPONENT_IDS.mediaGallery]: 'Media',
  [GATHER_COMPONENT_IDS.imageOverlay]: 'Media',
  [GATHER_COMPONENT_IDS.flow]: 'Flow',
  [GATHER_COMPONENT_IDS.processingView]: 'Flow',
  [GATHER_COMPONENT_IDS.outputReview]: 'Results',
  [GATHER_COMPONENT_IDS.instrumentError]: 'Results',
});

/** The declared category for a component, or null when Gather does not own it. */
export const categoryForComponent = (componentName) => BY_COMPONENT[componentName] ?? null;

/** Every Gather component that declares a category. */
export const categorizedComponents = () => Object.freeze({ ...BY_COMPONENT });
