/**
 * A form's composition slots, read from what ODK Central publishes.
 *
 * The device learns a form's structure from the XForms engine, which has the
 * instance state to evaluate it. An authoring tool has neither the state nor
 * any business evaluating anything, so it reads the two things Central serves
 * and marries them:
 *
 * ```text
 * GET .../forms/:id/fields   Central's own parse — name, path, type, binary
 *                            authoritative for types; carries no appearance,
 *                            no gather: namespace, and cannot distinguish a
 *                            question from a calculate
 *
 * GET .../forms/:id.xml      the definition — which groups are slots, which
 *                            artifact fills them, which children have controls
 * ```
 *
 * Neither is sufficient alone, which is why this file takes both.
 *
 * **This module reads declarations. It never evaluates expressions.** No
 * `relevant`, no `constraint`, no `required` — those are XPath over instance
 * state, and the engine that can do it correctly runs in the app. An authoring
 * surface that guessed them would be wrong the first time one mattered.
 *
 * It lives in Gather because recognising a composition slot *is* a Gather
 * semantic (`./recognition.js`), and the web repository must not grow a second
 * copy of these rules. It is published to the wrapper over the renderer's
 * authoring surface. See docs/central-form-context-design.md.
 */
import { compositionConfigFrom, nonEmptyString } from './recognition.js';
import { GATHER_NAMESPACE_URI, nodeNameOf, resourceNameFrom } from './compositionBinding.js';

const XFORMS_NS = 'http://www.w3.org/2002/xforms';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/** `/data/specimen/image` is a direct child of `/data/specimen`; a grandchild is not. */
const isDirectChildReference = (reference, parent) =>
  typeof reference === 'string' &&
  reference.startsWith(`${parent}/`) &&
  !reference.slice(parent.length + 1).includes('/');

/**
 * The namespaced Gather attributes on an element, as the bag the binding code
 * expects to find on a node.
 *
 * Returns `null` rather than an empty object when there are none, so that
 * `node.gather?.output` behaves the same as it does on a render-model node.
 */
const gatherAttributesOf = (element) => {
  const output = element.getAttributeNS(GATHER_NAMESPACE_URI, 'output');
  const retention = element.getAttributeNS(GATHER_NAMESPACE_URI, 'retention');
  if (!nonEmptyString(output) && !nonEmptyString(retention)) return null;
  return {
    ...(nonEmptyString(output) ? { output } : {}),
    ...(nonEmptyString(retention) ? { retention } : {}),
  };
};

/**
 * The declarations in a parsed form definition.
 *
 * DOM in, plain data out — so everything downstream is testable without a
 * browser, and the one browser-dependent step is this function alone.
 *
 * @param {Document} document a parsed XForm
 * @returns {{ slots: Array<{reference: string, compositionId: string|null,
 *                           resource: string|null, controls: Array<object>}> }}
 */
export const readFormBody = (document) => {
  // `gather:output` and `gather:retention` ride binds; `gather:composition`
  // rides the body group. Both are collected because the render model this
  // mirrors surfaces namespaced attributes from either side.
  const bindGather = new Map();
  for (const bind of document.getElementsByTagNameNS(XFORMS_NS, 'bind')) {
    const nodeset = bind.getAttribute('nodeset') ?? bind.getAttribute('ref');
    const gather = gatherAttributesOf(bind);
    if (nonEmptyString(nodeset) && gather) bindGather.set(nodeset, gather);
  }

  const body = document.getElementsByTagNameNS(XHTML_NS, 'body')[0];
  const slots = [];
  if (!body) return { slots };

  for (const group of body.getElementsByTagNameNS(XFORMS_NS, 'group')) {
    const reference = group.getAttribute('ref');
    if (!nonEmptyString(reference)) continue;

    // The recognition rules are Gather's and are not restated here: the two
    // meanings of the appearance token, and the inert trailing colon, are
    // whatever compositionConfigFrom says they are.
    const appearance = group.getAttribute('appearance') ?? '';
    const config = compositionConfigFrom(appearance.split(/\s+/).filter(Boolean));
    if (!config.enabled) continue;

    const controls = [];
    for (const element of group.getElementsByTagName('*')) {
      const controlReference = element.getAttribute?.('ref');
      if (!nonEmptyString(controlReference)) continue;
      if (!isDirectChildReference(controlReference, reference)) continue;
      // A `<label ref="jr:itext(...)">` also carries a ref; only elements in
      // the XForms namespace that address an instance node are controls.
      if (element.namespaceURI !== XFORMS_NS || element.localName === 'label') continue;
      controls.push({
        reference: controlReference,
        // `projectionFor` asks only whether this is an `upload`, and the
        // control element is what decides that — never the producer's type.
        nodeType: element.localName,
        gather: bindGather.get(controlReference) ?? gatherAttributesOf(element) ?? null,
      });
    }

    slots.push({
      reference,
      compositionId: config.compositionId,
      resource: resourceNameFrom(group.getAttributeNS(GATHER_NAMESPACE_URI, 'composition')),
      controls,
    });
  }

  return { slots };
};

/**
 * Normalized composition slots: declarations from the form, types from Central.
 *
 * The candidates produced here are the shape `bindCompositionOutputs` consumes,
 * which is the point — Review reports what the device will actually do, in the
 * device's own words, rather than approximating it with a second rule set.
 *
 * `required` is deliberately absent from every candidate. The form's
 * requiredness is an evaluated XPath expression, and binding already treats
 * effective requiredness as `compositionRequired || liveXFormsRequired`
 * (conventions §1a rule 4). Omitting it here leaves the producer's contract
 * visible and the form's contract honestly unanswered.
 *
 * @param {{ body: {slots: Array<object>}, fields: Array<{name: string, path: string,
 *           type?: string, binary?: boolean}> }} input
 */
export const compositionSlotsFrom = ({ body, fields = [] } = {}) => {
  const byPath = new Map((fields ?? []).map((field) => [field?.path, field]));
  const problems = [];

  const slots = (body?.slots ?? []).map((slot) => {
    const candidates = [];
    for (const control of slot.controls ?? []) {
      const field = byPath.get(control.reference);
      if (!field) {
        // The definition and the schema disagree. Reporting it beats binding
        // against a type nobody published.
        problems.push({
          code: 'GATHER_FORM_FIELD_NOT_IN_SCHEMA',
          reference: control.reference,
          message: `${control.reference} has a control in the form body but no entry in the form's published fields.`,
        });
        continue;
      }
      candidates.push({
        reference: control.reference,
        name: field.name ?? nodeNameOf(control.reference),
        nodeType: control.nodeType,
        // Central resolved the binds, so this is the type the submission will
        // actually carry — which is what `isProjectable` needs to check.
        valueType: field.type ?? null,
        binary: field.binary === true,
        parentReference: slot.reference,
        bodyBacked: true,
        ...(control.gather ? { gather: control.gather } : {}),
      });
    }

    if (candidates.length === 0) {
      problems.push({
        code: 'GATHER_COMPOSITION_NO_BINDABLE_CHILDREN',
        reference: slot.reference,
        message: `${slot.reference} is a composition slot with no bindable children, so no output could be written.`,
      });
    }

    return {
      path: slot.reference,
      resource: slot.resource,
      compositionId: slot.compositionId,
      fields: candidates,
    };
  });

  return { slots, problems };
};

/**
 * The whole read, for a caller holding a form's XML and its published fields.
 *
 * `domParser` is injectable only so this is reachable without a browser; the
 * default is the platform's own, because parsing XML is not something Gather
 * should be reimplementing.
 */
export const readCompositionSlots = ({ xml, fields = [], domParser } = {}) => {
  const parser = domParser ?? (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
  if (!parser) {
    throw new Error('Reading a form definition needs a DOMParser, and this platform has none.');
  }
  const document = parser.parseFromString(xml, 'text/xml');
  return compositionSlotsFrom({ body: readFormBody(document), fields });
};
