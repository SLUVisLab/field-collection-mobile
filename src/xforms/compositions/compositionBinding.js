/**
 * Binding a composition's outputs onto XForms nodes — **from the XForm itself**.
 *
 * There is no binding manifest. The composition group already carries the whole
 * contract, the way ODK Collect's external-app groups do: returned values match
 * fields in the group *by name and type*.
 *
 * ```text
 * <group ref="/data/flower_analysis" appearance="gather-composition"
 *        gather:composition="flower_v1.gather">
 *   <upload ref=".../image" mediatype="image/*"/>     image  → media projection
 *   <input  ref=".../area"/>                          area   → decimal
 *   <input  ref=".../petal_count"/>                   petal_count
 * ```
 *
 * What the XForm supplies, and Gather therefore never restates:
 *
 * | fact | source |
 * | --- | --- |
 * | where an output lands | the child's own reference |
 * | which output it is | the child's name, or `bind::gather:output` |
 * | scalar or media | `<upload>` / `binary` — the control type |
 * | is it required *now* | the engine's live evaluation of the bind |
 *
 * Two rules earn their keep:
 *
 * **Only body-backed children bind.** XForms permits a bound model node with no
 * presentation control, and the engine surfaces one (as `model-value`). Binding
 * to it would write where no other ODK client can see or fill by hand, which is
 * exactly the cross-client degradation this design exists to guarantee.
 *
 * **Only declared outputs bind.** Bindings come from the composition's
 * `result.outputs` matched against children, never from the children alone. A
 * child the composition does not produce stays hand-fillable; deriving bindings
 * from children would instead *clear* it on every Accept.
 *
 * Rationale in docs/composition-binding-reassessment.md.
 */

import { CompositionFieldError, compositionConfigFrom, nonEmptyString } from './recognition.js';

export { CompositionFieldError };

/** Gather's XForm extension namespace, as declared on the form's settings. */
export const GATHER_NAMESPACE_URI = 'http://gather.slu.edu/xforms';

/** The trailing name of an XForms reference: `/data/flower/area` → `area`. */
export const nodeNameOf = (reference) =>
  typeof reference === 'string' ? reference.split('/').filter(Boolean).pop() ?? null : null;

/**
 * The resource a composition group names.
 *
 * A bare filename is the canonical form. A `jr://…/name` URI is tolerated and
 * reduced to its basename, because the same file is separately declared to
 * Central as a `jr://` reference and an author may reasonably write either.
 */
export const resourceNameFrom = (value) => {
  if (!nonEmptyString(value)) return null;
  const name = value.startsWith('jr://') ? value.split('/').filter(Boolean).pop() : value;
  return nonEmptyString(name) ? name : null;
};

const isGroupNode = (node) => node?.nodeType === 'group';

/** A child of this group, in document order — not a grandchild. */
const directChildrenOf = (nodes, reference) =>
  (nodes ?? []).filter((node) => node?.parentReference === reference);

/**
 * How this output reaches the submission, read off the control.
 *
 * `<upload>` means the value is an asset whose bytes belong in the submission;
 * anything else is a scalar written into the node.
 */
const projectionFor = (node) => (node?.nodeType === 'upload' ? 'media' : 'none');

/**
 * The disposition of the working asset behind a media output.
 *
 * `media` defaults to `discard`: the XForm has already named a durable owner
 * for these bytes, so once promotion succeeds the working copy is a duplicate.
 * `keep` is the deliberate request to retain a project-local one. The default
 * does not generalise — see the refusal in `assertBinding`, and
 * docs/b-custom-composition-conventions.md §4b.
 */
const retentionFor = (node, projection) => {
  const declared = node?.gather?.retention ?? null;
  if (declared !== null && declared !== 'keep' && declared !== 'discard') {
    throw new CompositionFieldError(
      `${node.reference} declares an unsupported gather:retention: ${JSON.stringify(declared)}.`,
      { code: 'GATHER_COMPOSITION_BINDING_BAD_RETENTION', details: { reference: node.reference } }
    );
  }
  if (projection === 'media') return declared ?? 'discard';
  if (declared !== null) {
    throw new CompositionFieldError(
      `${node.reference} declares gather:retention but is not a media control, so there is no asset for it to govern.`,
      {
        code: 'GATHER_COMPOSITION_BINDING_RETENTION_WITHOUT_MEDIA',
        details: { reference: node.reference, retention: declared },
      }
    );
  }
  return null;
};

/**
 * Finds this form's composition groups and the children each may bind to.
 *
 * Returns **candidates**, not bindings: which children actually bind depends on
 * what the composition declares, and that is not known until its definition
 * loads. See `bindCompositionOutputs`.
 *
 * `problems` rather than throws, because every mismatch here is a silent-empty
 * risk of the kind that has bitten this area repeatedly — a group declaring a
 * composition with nothing to bind would otherwise render an empty field and
 * write nothing at all.
 *
 * @param {{ renderModel?: { nodes?: Array<object> } }} input
 */
export const resolveCompositionFields = ({ renderModel } = {}) => {
  const nodes = renderModel?.nodes ?? [];
  const fields = [];
  const problems = [];

  for (const node of nodes) {
    const config = compositionConfigFrom(node?.appearances);
    if (!config.enabled) continue;
    const reference = node?.reference;
    if (!nonEmptyString(reference)) continue;

    if (!isGroupNode(node)) {
      problems.push({
        code: 'GATHER_COMPOSITION_NOT_A_GROUP',
        reference,
        message: `${reference} carries a composition appearance but is a ${node?.nodeType ?? 'unknown'}, not a group.`,
      });
      continue;
    }

    const definitionResource = resourceNameFrom(node?.gather?.composition);
    // One of the two has to say which composition this is: the resource that
    // supplies it, or an id naming one this build registered.
    if (!definitionResource && !config.compositionId) {
      problems.push({
        code: 'GATHER_COMPOSITION_NO_RESOURCE',
        reference,
        message: `${reference} declares a composition but names no resource. Set gather:composition on the group.`,
      });
      continue;
    }

    const children = directChildrenOf(nodes, reference);
    const candidates = children.filter((child) => child?.bodyBacked !== false);
    if (candidates.length === 0) {
      problems.push({
        code: 'GATHER_COMPOSITION_NO_BINDABLE_CHILDREN',
        reference,
        message:
          children.length === 0
            ? `${reference} is a composition group with no child questions, so its results have nowhere to go.`
            : `${reference} has ${children.length} child node(s), none with a presentation control. A composition may only write where another ODK client could fill by hand.`,
      });
      continue;
    }

    fields.push({
      reference,
      compositionId: config.compositionId,
      definitionResource,
      candidates,
    });
  }

  return { fields, problems };
};

/**
 * Whether a declared output type can be projected into this XForms node.
 *
 * These are two legitimate contracts — producer type and destination type — so
 * the check is compatibility, not equality. An unrecognised producer type is
 * not checked: inventing a failure would be worse than not checking.
 */
const SCALAR_COMPATIBILITY = Object.freeze({
  string: ['string'],
  int: ['int'],
  decimal: ['decimal', 'int'],
  boolean: ['boolean'],
});

const isProjectable = (outputType, node, projection) => {
  if (!nonEmptyString(outputType)) return true;
  if (projection === 'media') {
    // A media destination takes an asset, which is an object on the producer's
    // side. A scalar declared into an <upload> is a real mismatch.
    return outputType === 'object';
  }
  const accepted = SCALAR_COMPATIBILITY[outputType];
  if (!accepted) return true;
  return accepted.includes(node?.valueType);
};

/**
 * Binds a composition's declared outputs onto the group's children.
 *
 * Requiredness is the **or** of two different contracts, not a duplicate of one:
 *
 * ```text
 * composition output required   producer — can it legitimately complete without this?
 * node currently required       form     — does this form require it right now?
 * ```
 *
 * The second is an evaluated XPath expression and varies with instance state, so
 * an output the composition treats as optional can still be required *now*.
 *
 * @param {{
 *   field: { reference: string, candidates: Array<object> },
 *   definition?: { id?: string, result?: { outputs?: Array<{path: string, type?: string, required?: boolean}> } }|null,
 * }} input
 * @returns {{ bindings: Array<object>, problems: Array<{code: string, reference: string, message: string}> }}
 */
export const bindCompositionOutputs = ({ field, definition } = {}) => {
  const problems = [];
  const reference = field?.reference ?? '<unknown>';
  const outputs = definition?.result?.outputs ?? [];
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return {
      bindings: [],
      problems: [
        {
          code: 'GATHER_COMPOSITION_NO_DECLARED_OUTPUTS',
          reference,
          message: `The composition for ${reference} declares no outputs, so nothing can be bound.`,
        },
      ],
    };
  }

  // `bind::gather:output` wins over the node's name — the escape hatch for the
  // case where an XLSForm name and a composition output name cannot match.
  const byOutputName = new Map();
  for (const node of field?.candidates ?? []) {
    const name = node?.gather?.output ?? nodeNameOf(node?.reference);
    if (!nonEmptyString(name)) continue;
    // The same output legitimately feeds two fields, so collect rather than
    // overwrite; a name colliding by accident shows up as two bindings, which
    // is what the author wrote.
    const existing = byOutputName.get(name);
    if (existing) existing.push(node);
    else byOutputName.set(name, [node]);
  }

  const bindings = [];
  for (const output of outputs) {
    const path = output?.path;
    if (!nonEmptyString(path)) continue;
    const matched = byOutputName.get(path);
    if (!matched) {
      problems.push({
        code: 'GATHER_COMPOSITION_OUTPUT_UNBOUND',
        reference,
        message: `The composition produces "${path}" but ${reference} has no question named "${path}", so that value has nowhere to go.`,
      });
      continue;
    }
    for (const node of matched) {
      let projection;
      let retention;
      try {
        projection = projectionFor(node);
        retention = retentionFor(node, projection);
      } catch (error) {
        problems.push({
          code: error?.code ?? 'GATHER_COMPOSITION_BINDING_INVALID',
          reference: node.reference,
          message: error?.message ?? String(error),
        });
        continue;
      }
      if (!isProjectable(output?.type, node, projection)) {
        problems.push({
          code: 'GATHER_COMPOSITION_OUTPUT_TYPE_MISMATCH',
          reference: node.reference,
          message: `The composition declares "${path}" as ${output.type}, which cannot be written to ${node.reference} (${node.nodeType}/${node.valueType ?? 'untyped'}).`,
        });
        continue;
      }
      bindings.push({
        path,
        reference: node.reference,
        // Producer contract OR form contract. Either alone makes it required.
        required: output?.required === true || node?.required === true,
        projection,
        retention,
      });
    }
  }

  return { bindings, problems };
};

/** The `{ reference, path }` bindings `createResultFieldWriter` consumes. */
export const writerBindingsFor = (field) =>
  (field?.bindings ?? []).map(({ reference, path }) => ({ reference, path }));
