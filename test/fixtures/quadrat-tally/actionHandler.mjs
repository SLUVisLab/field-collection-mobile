import { GATHER_ACTION_IDS } from '../../../packages/gather-catalog/src/index.js';

import { QUADRAT_TALLY_ACTIONS, QUADRAT_TALLY_DEFINITION } from './definition.mjs';

import { createExecutionReceipt } from '../../../src/scientific/provenance/receipt.js';

const DEFAULT_STATE_PATH = '/gather';

const statePathFor = (context) =>
  typeof context?.statePath === 'string' && context.statePath.startsWith('/')
    ? context.statePath
    : DEFAULT_STATE_PATH;

/**
 * The Quadrat Tally fixture's action handler.
 *
 * Fixture-only code, travelling with its definition. It exists to give the
 * composition→ODK path something minimal and deterministic to drive.
 *
 * There is **no `FlowController`** here: the composition has a single View, so
 * introducing a view selector would be ceremony. `Flow` is for choosing among
 * authored Views, and one View needs no choosing.
 *
 * On Accept it produces the typed result **and an execution receipt**. The
 * receipt matters even though nothing was computed by a model: "computed" in
 * the B-custom sense means *produced by the composition*, which is what
 * distinguishes this value from the same number typed straight into the
 * backing field by another ODK client (principle 5).
 *
 * `note` is present only when the tally was flagged uncertain, which is how
 * the absent-optional path — clear the field *and* delete its provenance —
 * gets exercised.
 *
 * @param {{ now?: () => string }} deps injected so a gate's output is stable
 */
export const createQuadratTallyActionHandler = ({ now = () => new Date().toISOString() } = {}) => {
  return ({ processor, onAcceptedResult } = {}) => {
    if (!processor?.model?.getSurface) {
      throw new Error('Quadrat Tally requires a MessageProcessor.');
    }

    return async ({ name, surfaceId, context = {} } = {}) => {
      const surface = processor.model.getSurface(surfaceId);
      if (!surface) throw new Error(`A2UI surface '${surfaceId}' is unavailable.`);
      const statePath = statePathFor(context);

      const state = () => surface.dataModel.get(statePath) ?? {};
      const setData = (patch) => {
        const next = { ...state(), ...patch };
        surface.dataModel.set(statePath, next);
        return next;
      };
      const countOf = () => {
        const raw = state().count;
        return Number.isInteger(raw) ? raw : 0;
      };

      switch (name) {
        case QUADRAT_TALLY_ACTIONS.increment:
          return setData({ count: countOf() + 1 });

        case QUADRAT_TALLY_ACTIONS.decrement:
          // A tally cannot go negative, and refusing to is better than
          // producing a result no XForms int field should ever hold.
          return setData({ count: Math.max(countOf() - 1, 0) });

        case QUADRAT_TALLY_ACTIONS.toggleUncertain:
          return setData({ uncertain: state().uncertain !== true });

        case GATHER_ACTION_IDS.accept: {
          const count = countOf();
          const uncertain = state().uncertain === true;
          // Outputs are scalars only. The composition never names an XPath —
          // the form's binding manifest decides where these land.
          const result = uncertain ? { count, note: 'uncertain' } : { count };
          const timestamp = now();
          const receipt = createExecutionReceipt({
            capability: QUADRAT_TALLY_DEFINITION.id,
            capabilityRevision: QUADRAT_TALLY_DEFINITION.revision,
            inputs: { tallied: count, flaggedUncertain: uncertain },
            outputs: result,
            runtime: { kind: 'composition', surfaceId },
            timestamp,
          });
          await onAcceptedResult?.(result, { surfaceId, statePath, receipt });
          return result;
        }

        default:
          throw new Error(`Quadrat Tally does not handle '${name}'.`);
      }
    };
  };
};
