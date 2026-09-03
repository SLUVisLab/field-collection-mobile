import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPOSITION_APPEARANCE,
  COMPOSITION_APPEARANCE_PREFIX,
  compositionConfigFrom,
} from '../../src/xforms/compositions/recognition.js';
import {
  bindCompositionOutputs,
  nodeNameOf,
  resolveCompositionFields,
  resourceNameFrom,
  writerBindingsFor,
} from '../../src/xforms/compositions/compositionBinding.js';

// The XForm group IS the binding contract. Rationale in
// docs/composition-binding-reassessment.md; the engine's exposure of the
// namespaced attributes is verified in experiments/namespaced-gather-attributes.

// --- recognition ---------------------------------------------------------

test('a bare appearance token marks the group, and says nothing more', () => {
  // Which composition it is comes from `body::gather:composition`, and the
  // artifact is the authority on its own id. An appearance is a rendering
  // property, so that is all it carries now.
  assert.deepEqual(compositionConfigFrom([COMPOSITION_APPEARANCE]), {
    enabled: true,
    compositionId: null,
  });
  assert.deepEqual(compositionConfigFrom(['field-list', COMPOSITION_APPEARANCE]), {
    enabled: true,
    compositionId: null,
  });
});

test('the id-bearing token still resolves, for a composition this build registered', () => {
  assert.deepEqual(compositionConfigFrom([`${COMPOSITION_APPEARANCE_PREFIX}flower_v1`]), {
    enabled: true,
    compositionId: 'flower_v1',
  });
  // A trailing colon naming nothing is inert rather than bound to an empty id.
  assert.equal(compositionConfigFrom([COMPOSITION_APPEARANCE_PREFIX]).enabled, false);
});

test('a group with no composition token is an ordinary group', () => {
  for (const appearances of [[], ['field-list'], null, undefined, new Set(['minimal'])]) {
    assert.equal(compositionConfigFrom(appearances).enabled, false);
  }
});

test('tokens are accepted from any iterable', () => {
  // The raw engine value is a Set-like iterable, not an array.
  assert.equal(compositionConfigFrom(new Set([COMPOSITION_APPEARANCE])).enabled, true);
});

// --- helpers -------------------------------------------------------------

test('a resource is named by filename, and a jr: URI reduces to its basename', () => {
  // The same file is separately declared to Central as a jr:// reference, so an
  // author may reasonably write either form.
  assert.equal(resourceNameFrom('flower_v1.gather'), 'flower_v1.gather');
  assert.equal(resourceNameFrom('jr://images/flower_v1.gather'), 'flower_v1.gather');
  assert.equal(resourceNameFrom(''), null);
  assert.equal(resourceNameFrom(null), null);
  assert.equal(nodeNameOf('/data/flower/petal_count'), 'petal_count');
  assert.equal(nodeNameOf(null), null);
});

// --- field resolution ----------------------------------------------------

const group = (extra = {}) => ({
  reference: '/data/flower',
  nodeType: 'group',
  appearances: [COMPOSITION_APPEARANCE],
  gather: { composition: 'flower_v1.gather' },
  ...extra,
});

const child = (name, extra = {}) => ({
  reference: `/data/flower/${name}`,
  nodeType: 'input',
  valueType: 'string',
  parentReference: '/data/flower',
  bodyBacked: true,
  required: false,
  gather: {},
  ...extra,
});

const model = (...nodes) => ({ renderModel: { nodes } });

test('a composition group offers its direct body-backed children as candidates', () => {
  const { fields, problems } = resolveCompositionFields(
    model(
      { reference: '/data/site_name', nodeType: 'input', parentReference: '/data', bodyBacked: true },
      group(),
      child('note'),
      child('image', { nodeType: 'upload', valueType: 'binary', mediaType: 'image' }),
      // A grandchild is not a candidate: the group is the namespace, one level.
      {
        reference: '/data/flower/nested/deep',
        nodeType: 'input',
        parentReference: '/data/flower/nested',
        bodyBacked: true,
      }
    )
  );
  assert.deepEqual(problems, []);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].definitionResource, 'flower_v1.gather');
  assert.deepEqual(
    fields[0].candidates.map((node) => node.reference),
    ['/data/flower/note', '/data/flower/image']
  );
});

test('a bound model node with no presentation control is not a binding destination', () => {
  // XForms permits it and the engine surfaces one — verified against the real
  // engine in experiments/namespaced-gather-attributes. Binding to it would
  // write where no other ODK client can see or fill by hand, which is the
  // degradation guarantee this whole design exists to keep.
  const { fields } = resolveCompositionFields(
    model(group(), child('note'), child('hidden_note', { nodeType: 'model-value', bodyBacked: false }))
  );
  assert.deepEqual(
    fields[0].candidates.map((node) => node.reference),
    ['/data/flower/note']
  );
});

test('a composition group with nothing bindable is reported, not rendered empty', () => {
  const empty = resolveCompositionFields(model(group()));
  assert.deepEqual(empty.fields, []);
  assert.equal(empty.problems[0].code, 'GATHER_COMPOSITION_NO_BINDABLE_CHILDREN');
  assert.match(empty.problems[0].message, /no child questions/);

  const hiddenOnly = resolveCompositionFields(
    model(group(), child('hidden', { nodeType: 'model-value', bodyBacked: false }))
  );
  assert.deepEqual(hiddenOnly.fields, []);
  assert.match(hiddenOnly.problems[0].message, /none with a presentation control/);
});

test('a composition appearance on something that is not a group is reported', () => {
  const { fields, problems } = resolveCompositionFields(
    model({ reference: '/data/flower', nodeType: 'input', appearances: [COMPOSITION_APPEARANCE] })
  );
  assert.deepEqual(fields, []);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_NOT_A_GROUP');
});

// --- output binding ------------------------------------------------------

const definition = (outputs) => ({ id: 'flower_v1', result: { outputs } });

const bind = (nodes, outputs) => {
  const { fields } = resolveCompositionFields(model(group(), ...nodes));
  return bindCompositionOutputs({ field: fields[0], definition: definition(outputs) });
};

test('outputs bind to the question that shares their name', () => {
  const { bindings, problems } = bind(
    [child('petal_count', { valueType: 'int' }), child('note')],
    [
      { path: 'petal_count', type: 'int', required: true },
      { path: 'note', type: 'string' },
    ]
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(bindings, [
    {
      path: 'petal_count',
      reference: '/data/flower/petal_count',
      required: true,
      projection: 'none',
      retention: null,
    },
    {
      path: 'note',
      reference: '/data/flower/note',
      required: false,
      projection: 'none',
      retention: null,
    },
  ]);
});

test('a question the composition does not produce is left alone, not cleared', () => {
  // Bindings come from the DECLARED OUTPUTS matched against children, never
  // from the children alone. Deriving them the other way round would write an
  // absent value into this question on every Accept, clearing whatever another
  // ODK client had typed there.
  const { bindings, problems } = bind(
    [child('note'), child('filled_by_hand')],
    [{ path: 'note', type: 'string' }]
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(
    bindings.map((binding) => binding.reference),
    ['/data/flower/note']
  );
});

test('an output with no question to land in is reported', () => {
  const { bindings, problems } = bind([child('note')], [{ path: 'area', type: 'decimal' }]);
  assert.deepEqual(bindings, []);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_OUTPUT_UNBOUND');
  assert.match(problems[0].message, /no question named "area"/);
});

test('bind::gather:output renames a question for one output', () => {
  // The escape hatch, for when an XLSForm name and an output name cannot match.
  const { bindings, problems } = bind(
    [child('petal_count', { valueType: 'int', gather: { output: 'petalCount' } })],
    [{ path: 'petalCount', type: 'int' }]
  );
  assert.deepEqual(problems, []);
  assert.equal(bindings[0].reference, '/data/flower/petal_count');
  assert.equal(bindings[0].path, 'petalCount');
});

test('one output legitimately feeds two questions', () => {
  const { bindings, problems } = bind(
    [child('note'), child('note_copy', { gather: { output: 'note' } })],
    [{ path: 'note', type: 'string' }]
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(
    bindings.map((binding) => binding.reference),
    ['/data/flower/note', '/data/flower/note_copy']
  );
});

test('the control type decides the projection, and media defaults to discard', () => {
  const { bindings } = bind(
    [child('image', { nodeType: 'upload', valueType: 'binary', mediaType: 'image' })],
    [{ path: 'image', type: 'object' }]
  );
  assert.equal(bindings[0].projection, 'media');
  // The XForm has already named a durable owner for these bytes, so the working
  // copy is a duplicate once promotion succeeds. b-custom §4b.
  assert.equal(bindings[0].retention, 'discard');
});

test('gather:retention keeps the working asset when an author asks for it', () => {
  const { bindings } = bind(
    [
      child('image', {
        nodeType: 'upload',
        valueType: 'binary',
        gather: { retention: 'keep' },
      }),
    ],
    [{ path: 'image', type: 'object' }]
  );
  assert.equal(bindings[0].retention, 'keep');
});

test('retention on a non-media question is refused, not defaulted', () => {
  // The media default does not generalise: with no durable XForms destination,
  // keep versus discard decides whether the bytes survive at all.
  const { bindings, problems } = bind(
    [child('note', { gather: { retention: 'discard' } })],
    [{ path: 'note', type: 'string' }]
  );
  assert.deepEqual(bindings, []);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_BINDING_RETENTION_WITHOUT_MEDIA');
});

test('an unsupported retention value is refused rather than ignored', () => {
  const { problems } = bind(
    [child('image', { nodeType: 'upload', valueType: 'binary', gather: { retention: 'maybe' } })],
    [{ path: 'image', type: 'object' }]
  );
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_BINDING_BAD_RETENTION');
});

test('requiredness is the OR of two different contracts', () => {
  // composition.required is the producer contract — can it legitimately
  // complete without this? node.required is the form contract, and it is an
  // evaluated XPath expression that varies with instance state.
  const cases = [
    { output: true, node: false, expected: true },
    { output: false, node: false, expected: false },
    { output: false, node: true, expected: true },
    { output: true, node: true, expected: true },
  ];
  for (const { output, node, expected } of cases) {
    const { bindings } = bind(
      [child('note', { required: node })],
      [{ path: 'note', type: 'string', required: output }]
    );
    assert.equal(bindings[0].required, expected, `output=${output} node=${node}`);
  }
});

test('an output type that cannot reach its destination is reported at load', () => {
  // Producer type versus destination type: two contracts, checked for
  // projectability rather than equality — which is what the binding manifest
  // never did, so a mismatch only surfaced later during coercion.
  const mismatch = bind([child('count', { valueType: 'int' })], [{ path: 'count', type: 'string' }]);
  assert.deepEqual(mismatch.bindings, []);
  assert.equal(mismatch.problems[0].code, 'GATHER_COMPOSITION_OUTPUT_TYPE_MISMATCH');

  // A scalar cannot be written into a media control.
  const intoMedia = bind(
    [child('image', { nodeType: 'upload', valueType: 'binary' })],
    [{ path: 'image', type: 'string' }]
  );
  assert.equal(intoMedia.problems[0].code, 'GATHER_COMPOSITION_OUTPUT_TYPE_MISMATCH');

  // decimal accepts an int node; an unrecognised producer type is not checked,
  // because inventing a failure is worse than not checking.
  assert.deepEqual(
    bind([child('area', { valueType: 'int' })], [{ path: 'area', type: 'decimal' }]).problems,
    []
  );
  assert.deepEqual(
    bind([child('blob')], [{ path: 'blob', type: 'something_new' }]).problems,
    []
  );
});

test('a composition declaring no outputs binds nothing, and says so', () => {
  const { bindings, problems } = bind([child('note')], []);
  assert.deepEqual(bindings, []);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_NO_DECLARED_OUTPUTS');
});

test('bindings come out in the shape the result writer already consumes', () => {
  const { bindings } = bind([child('note')], [{ path: 'note', type: 'string' }]);
  assert.deepEqual(writerBindingsFor({ bindings }), [
    { reference: '/data/flower/note', path: 'note' },
  ]);
  assert.deepEqual(writerBindingsFor(null), []);
});
