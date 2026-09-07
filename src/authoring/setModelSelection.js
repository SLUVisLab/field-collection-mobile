/**
 * Changes which model one call uses, **without changing how the Tool expresses
 * that choice**.
 *
 * Three authoring forms mean three different things, and a picker that
 * flattened them into one would rewrite the author's intent:
 *
 * ```text
 * modelRef omitted        Gather's default policy chooses
 * modelRef literal        this exact model, fixed
 * modelRef path-bound     the Tool chooses, from its own state
 * ```
 *
 * So a bound call stays bound: the value behind the binding is what changes,
 * and `{"modelRef": {"path": "/working/modelRef"}}` survives untouched. Turning
 * it into a literal would silently convert a Tool that selects dynamically into
 * one that cannot.
 *
 * When the binding cannot be resolved to one authored value, this refuses. It
 * is not a dataflow evaluator, and guessing would be worse than declining —
 * see `resolveBinding` in inspectComposition.js.
 *
 * A **shared** binding refuses too, unless the caller acknowledges it. Two
 * calls bound to the same path have one model between them, and a UI that
 * offered a per-call picker over that would be promising independence the
 * document does not have. `affected` names every occurrence a change would
 * move, so the caller can say so before it happens.
 */

export class ModelSelectionError extends Error {
  constructor(message, { code, occurrenceId = null, affectedOccurrences = [] } = {}) {
    super(message);
    this.name = 'ModelSelectionError';
    this.code = code;
    this.occurrenceId = occurrenceId;
    /** Every occurrence the refused change would have moved. */
    this.affectedOccurrences = affectedOccurrences;
  }
}

const clone = (value) =>
  typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

const atPath = (root, path) => path.reduce((current, key) => current?.[key], root);

const writeInto = (container, segments, value) => {
  if (segments.length === 0) return value;
  const [head, ...rest] = segments;
  const next = container?.[head];
  return { ...container, [head]: writeInto(next, rest, value) };
};

/**
 * @param {{
 *   document: unknown[],
 *   analysis: { modelCalls: Array<object> },
 *   occurrenceId: string,
 *   modelRef: object|null,   null means "omit — use Gather's default"
 *   models?: Array<{ modelRef: object, taskProfile?: string }>,
 * }} input
 * @returns {{ document: unknown[], form: 'literal'|'binding', affectedOccurrences: string[] }}
 */
export const setModelSelection = ({
  document,
  analysis,
  occurrenceId,
  modelRef = null,
  models = [],
  acknowledgeShared = false,
} = {}) => {
  const call = (analysis?.modelCalls ?? []).find((entry) => entry.occurrenceId === occurrenceId);
  if (!call) {
    throw new ModelSelectionError(`No model-backed call ${occurrenceId} in this Tool.`, {
      code: 'GATHER_SELECTION_NO_SUCH_CALL',
      occurrenceId,
    });
  }

  // Compatibility is checked before anything is written: a Tool that briefly
  // holds an incompatible model is a Tool somebody can save.
  if (modelRef) {
    const declared = models.find((model) => model.modelRef.revision === modelRef.revision);
    const profile = declared?.taskProfile ?? modelRef.taskProfile ?? null;
    if (call.acceptedModelProfiles.length > 0 && !call.acceptedModelProfiles.includes(profile)) {
      throw new ModelSelectionError(
        `${profile ?? 'that model'} is not accepted by ${call.capabilityId}, which accepts ` +
          `${call.acceptedModelProfiles.join(', ')}.`,
        { code: 'GATHER_SELECTION_INCOMPATIBLE', occurrenceId }
      );
    }
  }

  const next = clone(document);

  if (call.model.mode === 'bound') {
    const resolution = call.model.resolution;
    if (resolution?.kind !== 'static') {
      throw new ModelSelectionError(
        `${call.capabilityId} binds its model to ${call.model.binding}, and the document does not ` +
          `fix one value there. ${resolution?.reason ?? ''} Change it in the Composer instead.`.trim(),
        { code: 'GATHER_SELECTION_BINDING_NOT_STATIC', occurrenceId }
      );
    }
    const shared = call.model.sharedWith ?? [];
    if (shared.length > 0 && !acknowledgeShared) {
      throw new ModelSelectionError(
        `${call.capabilityId} shares ${call.model.binding} with ${shared.length} other call(s), ` +
          'so changing it changes them too. Acknowledge the shared change to proceed.',
        {
          code: 'GATHER_SELECTION_BINDING_SHARED',
          occurrenceId,
          affectedOccurrences: call.model.selectionGroup.occurrenceIds,
        }
      );
    }
    if (!modelRef) {
      throw new ModelSelectionError(
        `${call.capabilityId} binds its model to ${call.model.binding}. Removing the pin would ` +
          'mean deciding what that binding should hold, which is an authoring change, not a ' +
          'model choice. Edit it in the Composer.',
        { code: 'GATHER_SELECTION_BINDING_NOT_REMOVABLE', occurrenceId }
      );
    }
    // Write behind the binding, leaving the binding itself alone.
    const message = next[resolution.source.messageIndex];
    const bindingSegments = call.model.binding.split('/').filter(Boolean);
    const writeSegments = resolution.source.path.split('/').filter(Boolean);
    const remainder = bindingSegments.slice(writeSegments.length);
    const key = message.updateDataModel.value !== undefined ? 'value' : 'contents';
    message.updateDataModel[key] = writeInto(message.updateDataModel[key], remainder, clone(modelRef));
    return { document: next, form: 'binding', affectedOccurrences: call.model.selectionGroup.occurrenceIds };
  }

  // Literal forms: the argument itself is the selection.
  const args = atPath(next, call.documentPath)?.action?.functionCall?.args;
  if (!args) {
    throw new ModelSelectionError(`Could not reach the arguments of ${occurrenceId}.`, {
      code: 'GATHER_SELECTION_UNREACHABLE',
      occurrenceId,
    });
  }
  if (modelRef) {
    args.modelRef = clone(modelRef);
  } else {
    // Absence is the default. Nothing is written in its place.
    delete args.modelRef;
  }
  // A literal selection moves exactly one call, always.
  return { document: next, form: 'literal', affectedOccurrences: [occurrenceId] };
};
