/**
 * Pure presentation helpers over the public engine projections. They never
 * inspect XForm XML, infer relevance, calculate values, or own form state.
 */
import { multiImageConfigFrom } from './collectionField.js';

export const controlKindFor = (node) => {
  const type = node?.nodeType;
  if (type === 'group') return 'group';
  // A repeat carrying the Gather appearance is a collection field, not an
  // ordinary repeat. Other ODK clients still see the plain repeat — see
  // docs/b-standard-field-conventions.md.
  if (
    typeof type === 'string' &&
    type.startsWith('repeat-range:') &&
    multiImageConfigFrom(node?.appearances).enabled
  ) {
    return 'multi-image';
  }
  if (type === 'note') return 'note';
  if (type === 'model-value') return 'calculate';
  if (typeof type === 'string' && type.startsWith('repeat-range:')) return 'repeat';
  if (type === 'repeat-instance') return 'repeat-instance';
  if (type === 'select') return node?.selectType === 'select' ? 'select-multiple' : 'select-one';
  if (type === 'upload' && node?.valueType === 'binary' && node?.mediaType === 'image') {
    return 'image-upload';
  }
  if (type === 'input' && ['string', 'int', 'decimal'].includes(node?.valueType)) {
    return node.valueType === 'string' ? 'text' : node.valueType;
  }
  return type === 'root' ? 'structural' : 'unsupported';
};

export const isNodeRelevant = (node, snapshot) =>
  snapshot?.nodesByReference?.[node.reference]?.relevant !== false;

/**
 * The ordered controls to render.
 *
 * A **collection field owns its whole subtree.** `MultiImageCapture` renders the
 * repeat's instances itself, so the generic repeat-instance and image-upload
 * controls must not render them a second time underneath it — which is exactly
 * what happened until the interactive camera gate showed the duplicate stack.
 * See docs/components-capabilities-ownership.md §21.
 */
export const visibleRenderNodes = (renderModel, snapshot) => {
  const nodes = (renderModel?.nodes ?? []).filter(
    (node) => controlKindFor(node) !== 'structural' && isNodeRelevant(node, snapshot)
  );
  const ownedPrefixes = nodes
    .filter((node) => controlKindFor(node) === 'multi-image' && typeof node.reference === 'string')
    .map((node) => `${node.reference}[`);
  if (ownedPrefixes.length === 0) return nodes;
  return nodes.filter(
    (node) =>
      controlKindFor(node) === 'multi-image' ||
      !ownedPrefixes.some(
        (prefix) => typeof node.reference === 'string' && node.reference.startsWith(prefix)
      )
  );
};

/**
 * This is navigation-only projection of the engine's ordered render sequence,
 * not a form schema. Labels/references remain engine-derived.
 */
export const outlineFor = (renderModel, snapshot) =>
  visibleRenderNodes(renderModel, snapshot)
    .filter((node) => node.label && controlKindFor(node) !== 'repeat-instance')
    .map((node) => ({
      reference: node.reference,
      label: node.label,
      depth: node.depth,
      kind: controlKindFor(node),
    }));
