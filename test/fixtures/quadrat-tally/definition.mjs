import { GATHER_ACTION_IDS, GATHER_CATALOG_ID } from '../../../packages/gather-catalog/src/index.js';

/**
 * Quadrat Tally — a **minimal authored composition**, used as a fixture.
 *
 * Deliberately the smallest thing that exercises the whole composition→ODK
 * path: it produces a typed result with a **required scalar and an optional
 * scalar**, and nothing else. No camera, no model, no capability — so a gate
 * driving it is testing the binding, commit and provenance seams rather than
 * ONNX or hardware.
 *
 * ```text
 * View: tally   Text + / − + flag + Accept     → { count, note? }
 * ```
 *
 * Two things it demonstrates that Photo Capture cannot:
 *
 * - **Scalar outputs.** Photo Capture's result is a single `ImageAsset`, so it
 *   never exercised `createResultFieldWriter`'s coercion or a binding manifest.
 *   `count` is required; `note` appears only when flagged, which is how the
 *   absent-optional path (clear the field *and* its provenance) gets covered.
 * - **Composition-local actions.** `+1` and `−1` are this composition's own
 *   event names, not catalog vocabulary. Catalog action ids are fixed because
 *   they ship with a *Component*; a composition's own buttons are its own
 *   business, and the runtime routes whatever name arrives to its handler.
 *
 * "Computed" in the B-custom sense means **produced by the composition**, not
 * produced by a model — so a tally still earns an execution receipt. That is
 * what distinguishes this value from the same number typed straight into the
 * backing field by another ODK client (principle 5).
 */

export const QUADRAT_TALLY_VIEWS = Object.freeze({
  tally: 'tally',
});

/** This composition's own actions. Not catalog vocabulary — see above. */
export const QUADRAT_TALLY_ACTIONS = Object.freeze({
  increment: 'fixture.quadratTally.increment',
  decrement: 'fixture.quadratTally.decrement',
  toggleUncertain: 'fixture.quadratTally.toggleUncertain',
});

const STATE_PATH = '/gather';
const SURFACE_ID = 'quadrat-tally';

/**
 * The canonical first-party artifact, loaded rather than restated.
 *
 * Keeping a parallel copy here is what made "the composition under test" and
 * "the composition that ships" two different things. Everything else in this
 * module is test scaffolding — view ids and action names the harness drives —
 * and is not part of the artifact.
 */
export { default as QUADRAT_TALLY_DEFINITION } from '../../../compositions/tally/quadrat/quadrat_tally_v1.a2ui.json' with { type: 'json' };


/** The binding manifest a *form* hosting this composition would ship. */
