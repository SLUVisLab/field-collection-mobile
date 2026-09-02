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

export const QUADRAT_TALLY_DEFINITION = Object.freeze({
  id: 'gather.fixture.quadrat-tally',
  revision: '0.1.0',
  title: 'Quadrat Tally',
  description: 'Count individuals in a quadrat and optionally flag the count as uncertain.',
  catalogId: GATHER_CATALOG_ID,
  surfaceId: SURFACE_ID,
  statePath: STATE_PATH,
  /**
   * The declared outputs. Names only — **no XPaths**: the same composition has
   * to be reusable across forms, so the mapping is the form's binding manifest
   * (docs/b-custom-composition-conventions.md §1).
   */
  result: Object.freeze({
    kind: 'object',
    outputs: Object.freeze([
      Object.freeze({ path: 'count', type: 'int', required: true }),
      Object.freeze({ path: 'note', type: 'string', required: false }),
    ]),
  }),
  messages: Object.freeze([
    {
      version: 'v0.9',
      createSurface: { surfaceId: SURFACE_ID, catalogId: GATHER_CATALOG_ID, sendDataModel: true },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'root', component: 'Column', children: ['tallyView'] },

          {
            id: 'tallyView',
            component: 'Column',
            children: ['title', 'countText', 'plusButton', 'minusButton', 'flagButton', 'acceptButton'],
          },
          { id: 'title', component: 'Text', text: 'Quadrat tally', variant: 'h3' },
          // Upstream Basic Catalog vocabulary throughout: this fixture invents
          // no Component, only its own actions.
          { id: 'countText', component: 'Text', text: { path: '/gather/count' }, variant: 'body' },
          {
            id: 'plusButton',
            component: 'Button',
            variant: 'primary',
            child: 'plusLabel',
            action: { event: { name: QUADRAT_TALLY_ACTIONS.increment, context: { statePath: STATE_PATH } } },
          },
          { id: 'plusLabel', component: 'Text', text: 'Add one', variant: 'body' },
          {
            id: 'minusButton',
            component: 'Button',
            child: 'minusLabel',
            action: { event: { name: QUADRAT_TALLY_ACTIONS.decrement, context: { statePath: STATE_PATH } } },
          },
          { id: 'minusLabel', component: 'Text', text: 'Remove one', variant: 'body' },
          {
            id: 'flagButton',
            component: 'Button',
            child: 'flagLabel',
            action: {
              event: { name: QUADRAT_TALLY_ACTIONS.toggleUncertain, context: { statePath: STATE_PATH } },
            },
          },
          { id: 'flagLabel', component: 'Text', text: 'Flag as uncertain', variant: 'body' },
          {
            id: 'acceptButton',
            component: 'Button',
            variant: 'primary',
            child: 'acceptLabel',
            action: { event: { name: GATHER_ACTION_IDS.accept, context: { statePath: STATE_PATH } } },
          },
          { id: 'acceptLabel', component: 'Text', text: 'Accept tally', variant: 'body' },
        ],
      },
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: SURFACE_ID,
        path: STATE_PATH,
        value: { status: QUADRAT_TALLY_VIEWS.tally, count: 0, uncertain: false },
      },
    },
  ]),
  hostActions: Object.freeze([
    QUADRAT_TALLY_ACTIONS.increment,
    QUADRAT_TALLY_ACTIONS.decrement,
    QUADRAT_TALLY_ACTIONS.toggleUncertain,
    GATHER_ACTION_IDS.accept,
  ]),
});

/** The binding manifest a *form* hosting this composition would ship. */
export const QUADRAT_TALLY_MANIFEST = Object.freeze({
  version: 1,
  fields: [
    {
      reference: '/data/quadrat',
      composition: QUADRAT_TALLY_DEFINITION.id,
      // The composition's definition travels with the form as a resource.
      definition: `${QUADRAT_TALLY_DEFINITION.id}.a2ui.json`,
      bindings: [
        { path: 'count', reference: '/data/quadrat/count', required: true },
        { path: 'note', reference: '/data/quadrat/note' },
      ],
    },
  ],
});
