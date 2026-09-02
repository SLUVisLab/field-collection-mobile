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

export const visibleRenderNodes = (renderModel, snapshot) =>
  (renderModel?.nodes ?? []).filter(
    (node) => controlKindFor(node) !== 'structural' && isNodeRelevant(node, snapshot)
  );

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
