/**
 * A read model over an ordinary authored A2UI document.
 *
 * The wrapper's Models, Validate and Publish panels all need the same answer to
 * "what has the researcher actually built?" — and computing it three times, or
 * inventing a Tool AST to hold it, would be three chances to disagree. This is
 * that one answer.
 *
 * ```text
 * A2UI document  →  inspectComposition()  →  capabilities, model calls, outputs, issues
 *                                            ↓
 *                                   Models · Validate · Publish
 * ```
 *
 * **The A2UI document stays authoritative.** Nothing here is persisted, nothing
 * is added to the artifact, and no identifier is minted inside it: a model-backed
 * call is addressed by where it *is* in the document, so a Tool that has never
 * been near the wrapper analyzes exactly the same way.
 *
 * Capability semantics arrive as data (`capabilities`), not as a second
 * registry — see `apps/renderer/scripts/generate-model-catalog.mjs`, which
 * projects them from `CAPABILITY_DEFINITIONS` at build time the same way it
 * projects the Model Catalog.
 */

/** `image.segment` ⇄ `image_segment`. The mapping is Gather's, and reversible. */
export class CompositionShapeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CompositionShapeError';
    this.code = 'GATHER_NOT_A_COMPOSITION';
  }
}

export const capabilityIdForFunction = (functionName) =>
  typeof functionName === 'string' && functionName.includes('_')
    ? functionName.replace(/_/g, '.')
    : null;

const componentsOf = (document) =>
  (Array.isArray(document) ? document : []).flatMap((message, messageIndex) =>
    (message?.updateComponents?.components ?? []).map((component, componentIndex) => ({
      component,
      // Relative to the document itself, which *is* the array of messages —
      // the same value the Composer loads and the Library stores.
      path: [messageIndex, 'updateComponents', 'components', componentIndex],
    }))
  );

/**
 * A stable address for one call, derived from document structure.
 *
 * Two `image_segment` calls in one Tool are different occurrences and must stay
 * separately selectable, so the id encodes position. It is stable across a
 * round trip through the editor and deliberately *not* stable across
 * restructuring — a call that moved is a different call, and silently
 * retargeting a model selection at it would be worse than losing the selection.
 */
const occurrenceIdFor = (path) => path.join('.');

const segmentsOf = (path) =>
  typeof path === 'string' ? path.split('/').filter(Boolean) : null;

const readAt = (value, segments) =>
  segments.reduce((current, segment) => (current == null ? current : current[segment]), value);

const isModelRefShaped = (value) =>
  Boolean(value) && typeof value === 'object' && typeof value.revision === 'string';

/**
 * How certain the authored document is about a bound model's value.
 *
 * Deliberately **not** a dataflow evaluator. It answers one narrow question —
 * "does exactly one authored `updateDataModel` write this path, with nothing
 * able to overwrite it?" — and says `dynamic` for everything else. A wrapper
 * that guessed here would silently rewrite a Tool whose author expressed
 * indirection on purpose.
 */
const resolveBinding = ({ document, bindingPath }) => {
  const wanted = segmentsOf(bindingPath);
  if (!wanted) return { kind: 'dynamic', modelRef: null, reason: 'The binding names no path.' };

  const writes = [];
  for (const [messageIndex, message] of (Array.isArray(document) ? document : []).entries()) {
    const update = message?.updateDataModel;
    if (!update) continue;
    const at = segmentsOf(update.path);
    if (!at) continue;
    // A write is relevant if it lands on the path or on an ancestor of it.
    const isAncestor = at.every((segment, index) => wanted[index] === segment);
    if (!isAncestor || at.length > wanted.length) continue;
    const value = readAt(update.value ?? update.contents, wanted.slice(at.length));
    writes.push({ messageIndex, path: update.path, depth: at.length, value });
  }

  // Anything that can write the path at runtime makes the authored value a
  // starting point rather than the answer.
  const overwritten = componentsOf(document).some(({ component }) => {
    const target = segmentsOf(component?.action?.resultPath);
    if (!target) return false;
    return target.every((segment, index) => wanted[index] === segment) || 
      wanted.every((segment, index) => target[index] === segment);
  });
  if (overwritten) {
    return {
      kind: 'dynamic',
      modelRef: null,
      reason: `An action writes ${bindingPath} at run time, so its value is not fixed by the document.`,
    };
  }

  const authored = writes.filter((write) => isModelRefShaped(write.value));
  if (authored.length !== 1) {
    return {
      kind: 'dynamic',
      modelRef: null,
      reason:
        authored.length === 0
          ? `Nothing in the document authors a ModelRef at ${bindingPath}.`
          : `${authored.length} messages author a value at ${bindingPath}.`,
    };
  }
  const [only] = authored;
  return {
    kind: 'static',
    modelRef: only.value,
    // Where a wrapper must write to change it, without touching the binding.
    source: { messageIndex: only.messageIndex, path: only.path, depth: only.depth },
    reason: null,
  };
};

const modelSelectionOf = (args) => {
  const declared = args?.modelRef;
  // `{path: …}` is a data-model binding, not a literal ModelRef — the Tool is
  // choosing at runtime, which is neither "default" nor a pin we can report.
  if (declared && typeof declared === 'object' && typeof declared.path === 'string') {
    return { mode: 'bound', modelRef: null, binding: declared.path };
  }
  if (declared && typeof declared === 'object' && typeof declared.revision === 'string') {
    return { mode: 'explicit', modelRef: declared, binding: null };
  }
  // Absence *is* the default. There is no sentinel to look for.
  return { mode: 'default', modelRef: null, binding: null };
};

/**
/**
 * The declared output contract, if the composition carries one.
 *
 * A2UI v0.9 has no concept of a result schema — its whole server-to-client
 * vocabulary is `createSurface`, `updateComponents`, `updateDataModel` and
 * `deleteSurface`, all `.strict()`. So the declaration is Gather's `result`
 * block, which is the contract `bindCompositionOutputs` already consumes and
 * which the canonical Tool has declared since M10.
 *
 * It deliberately cannot ride in the completion call's `outputs` argument:
 * there, a value is a data-model *binding* (`{ path: '/working/area/value' }`)
 * while the document is being authored, and the *resolved value* by the time
 * the function runs. One field cannot carry both plus a type without the two
 * meanings colliding.
 *
 * A composition that declares no `result` block yields `null` here, which is a
 * real and reportable state — a Tool whose outputs have no declared types.
 * Passing the *message list* is not that state and is refused: it is the
 * mistake that made a package no device could load.
 */
const resultOf = (composition) => {
  const outputs = composition?.result?.outputs;
  if (!Array.isArray(outputs)) return null;
  const declared = outputs.filter((output) => typeof output?.path === 'string');
  return declared.length > 0 ? { kind: 'object', outputs: declared } : null;
};

/**
/**
 * The composition, or a refusal naming the mistake.
 *
 * `messages` is not the composition. It is the A2UI document *inside* one, and
 * the difference cost two defects on 2026-09-06 — a Library draft that threw
 * away its declared output types, and a `.gather` whose composition.a2ui.json
 * was an array that `definitionLoader` would reject on the device that received
 * it. Both were silent. Nothing in the chain
 *
 * ```text
 * draft.document → inspectComposition → packTool → definitionLoader
 * ```
 *
 * accepts one where the other belongs any more.
 */
const requireComposition = (composition) => {
  if (Array.isArray(composition)) {
    throw new CompositionShapeError(
      'That is a message list, not a composition. A composition is the object around it — id, ' +
        'catalogId, surfaceId, its declared result, and messages.'
    );
  }
  if (typeof composition !== 'object' || composition === null || !Array.isArray(composition.messages)) {
    throw new CompositionShapeError('A composition is an object with a messages array.');
  }
  return composition;
};

/**
 * @param {{
 *   composition: { id?: string, result?: object, messages: unknown[] },
 *   capabilities: Array<{ id: string, functionName: string, acceptedModelProfiles?: string[], takesModelRef?: boolean }>,
 *   models?: Array<{ modelRef: object, taskProfile?: string, displayName?: string, defaultFor?: string[] }>,
 * }} input
 */
export const inspectComposition = ({ composition, capabilities = [], models = [] } = {}) => {
  const whole = requireComposition(composition);
  const declaredResult = resultOf(whole);
  const messages = whole.messages;
  const byFunction = new Map(capabilities.map((entry) => [entry.functionName, entry]));
  const calls = [];
  const issues = [];
  let outputs = [];

  for (const { component, path } of componentsOf(messages)) {
    const call = component?.action?.functionCall;
    if (!call?.call) continue;

    const capability = byFunction.get(call.call) ?? null;
    const record = {
      occurrenceId: occurrenceIdFor(path),
      functionName: call.call,
      capabilityId: capability?.id ?? capabilityIdForFunction(call.call),
      componentId: component.id ?? null,
      documentPath: path,
      isCapability: capability != null,
      acceptedModelProfiles: capability?.acceptedModelProfiles ?? [],
      model: null,
    };

    if (capability?.takesModelRef) {
      record.model = modelSelectionOf(call.args);
      if (record.model.mode === 'bound') {
        record.model.resolution = resolveBinding({ document: messages, bindingPath: record.model.binding });
      }
      const compatible = models.filter((model) =>
        record.acceptedModelProfiles.includes(model.taskProfile)
      );
      record.compatibleModels = compatible;
      // A statically resolved binding names one model as surely as a literal
      // does, so it is checked the same way — while staying `mode: 'bound'`,
      // because the author expressed indirection and that is not ours to erase.
      const pinned =
        record.model.mode === 'explicit'
          ? record.model.modelRef
          : record.model.resolution?.kind === 'static'
            ? record.model.resolution.modelRef
            : null;
      if (pinned) {
        const known = compatible.find((model) => model.modelRef.revision === pinned.revision);
        if (!known) {
          issues.push({
            code: 'GATHER_TOOL_MODEL_NOT_COMPATIBLE',
            occurrenceId: record.occurrenceId,
            message:
              `${record.capabilityId} pins ${pinned.revision}, which this ` +
              'distribution does not declare as compatible with it.',
          });
        }
      }
    }
    calls.push(record);

    // The terminal call names what the Tool produces. Reading it from the
    // document rather than a manifest is the same rule the runtime follows.
    if (call.call === 'gather_completeComposition') {
      outputs = Object.keys(call.args?.outputs ?? {});
    }
  }

  if (calls.length === 0) {
    issues.push({
      code: 'GATHER_TOOL_NO_CALLS',
      message: 'This Tool invokes no Gather Functions, so it produces nothing to submit.',
    });
  }
  if (outputs.length === 0) {
    issues.push({
      code: 'GATHER_TOOL_NO_OUTPUTS',
      message:
        'No gather_completeComposition call declares outputs, so nothing would reach the form.',
    });
  }

  /**
   * Aliasing: two calls bound to the same path do not have independently
   * selectable models, however separately addressable they are. Changing the
   * authored value behind one changes both, and a panel that implied
   * per-call independence would be lying about a coupling the author wrote
   * deliberately.
   *
   * Only exact path equality counts. An ancestor/descendant relationship could
   * alias too, but inferring that reliably starts to become the dataflow
   * evaluator we are not building — so it is left to `resolveBinding`, which
   * already reports such a path as `dynamic` when more than one message writes
   * it.
   */
  const boundCalls = calls.filter((call) => call.model?.mode === 'bound');
  for (const call of boundCalls) {
    const group = boundCalls.filter((other) => other.model.binding === call.model.binding);
    call.model.sharedWith = group
      .filter((other) => other !== call)
      .map((other) => other.occurrenceId);
    // The selection *source*, as opposed to the occurrences that read it. A UI
    // renders one control per group, not one per occurrence.
    call.model.selectionGroup = {
      kind: 'shared-binding',
      key: call.model.binding,
      occurrenceIds: group.map((other) => other.occurrenceId),
    };
  }
  // A literal is its own group of one, so a caller never has to special-case
  // the shape depending on the authoring form.
  for (const call of calls) {
    if (!call.model || call.model.selectionGroup) continue;
    call.model.selectionGroup = {
      kind: call.model.mode === 'default' ? 'unset' : 'literal',
      key: call.occurrenceId,
      occurrenceIds: [call.occurrenceId],
    };
  }

  // What packaging will need: selection *syntax* and dependency *certainty* are
  // different questions. A package cannot truthfully say "requires A" if the
  // Tool can dynamically select B.
  for (const call of calls) {
    if (!call.model) continue;
    call.dependency =
      call.model.mode === 'default'
        ? { certainty: 'unresolved', modelRef: null }
        : call.model.mode === 'explicit'
          ? { certainty: 'exact', modelRef: call.model.modelRef }
          : call.model.resolution?.kind === 'static'
            ? { certainty: 'exact', modelRef: call.model.resolution.modelRef }
            : { certainty: 'indeterminate', modelRef: null };
  }

  const capabilityIds = [
    ...new Set(calls.filter((call) => call.isCapability).map((call) => call.capabilityId)),
  ];

  return {
    capabilities: capabilityIds,
    calls,
    modelCalls: calls.filter((call) => call.model != null),
    // Names, always — what the completion call actually hands over, and what a
    // package manifest lists.
    outputs,
    /**
     * The declared types, or `null` when the Tool declares none.
     *
     * `null` is the honest answer and must not be softened into an empty
     * contract: binding treats an output with no declared type as projectable
     * anywhere, so "no declaration" and "declared compatible" are different
     * claims and only one of them has been checked.
     */
    result: declaredResult,
    /** Outputs the completion call produces that the result block never declares. */
    undeclaredOutputs: declaredResult
      ? outputs.filter((name) => !declaredResult.outputs.some((output) => output.path === name))
      : outputs,
    issues,
  };
};
