/**
 * Pure presentation helpers over the public engine projections. They never
 * inspect XForm XML, infer relevance, calculate values, or own form state.
 */
import { multiImageConfigFrom } from './collectionField.js';
import { compositionConfigFrom } from './compositions/recognition.js';

export const controlKindFor = (node) => {
  const type = node?.nodeType;
  // A group carrying the Gather appearance hosts an authored composition. The
  // backing fields stay ordinary writable XForms values, so other ODK clients
  // see a plain group they can fill by hand — see
  // docs/b-custom-composition-conventions.md §1 and §2.
  if (type === 'group') {
    return compositionConfigFrom(node?.appearances).enabled ? 'composition' : 'group';
  }
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
/**
 * The prefix that marks a control's own subtree, or `null` if it owns nothing.
 *
 * The two owning kinds need **different** prefixes, which is easy to get wrong:
 * a collection field's children are repeat instances (`/data/photos[1]/frame`),
 * while a composition group's children carry no index
 * (`/data/flower/petal_count`). Both end at a path boundary, so a sibling like
 * `/data/photos_notes` or `/data/flower_notes` is untouched.
 */
const ownedPrefixFor = (node) => {
  if (typeof node?.reference !== 'string' || node.reference.length === 0) return null;
  switch (controlKindFor(node)) {
    case 'multi-image':
      return `${node.reference}[`;
    case 'composition':
      return `${node.reference}/`;
    default:
      return null;
  }
};

export const visibleRenderNodes = (renderModel, snapshot) => {
  const nodes = (renderModel?.nodes ?? []).filter(
    (node) => controlKindFor(node) !== 'structural' && isNodeRelevant(node, snapshot)
  );
  const ownedPrefixes = nodes.map(ownedPrefixFor).filter(Boolean);
  if (ownedPrefixes.length === 0) return nodes;
  // An owning node never matches its own prefix — `/data/photos` does not start
  // with `/data/photos[`, nor `/data/flower` with `/data/flower/` — so it needs
  // no special case, and a nested owning node is correctly suppressed by the
  // outer one.
  return nodes.filter(
    (node) => !ownedPrefixes.some((prefix) => node.reference?.startsWith(prefix))
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
