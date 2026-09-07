// Normalizing a form's composition slots from Central's two sources, and then
// binding a real Tool's outputs against the result. The fixture is the actual
// M10 acceptance form and the actual canonical Tool, so what these assert is
// what the device does.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { inspectComposition } from '../../src/authoring/inspectComposition.js';
import { compositionSlotsFrom } from '../../src/xforms/compositions/formStructure.js';
import { bindCompositionOutputs } from '../../src/xforms/compositions/compositionBinding.js';

const read = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const TOOL = JSON.parse(readFileSync(read(
  '../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json'), 'utf8'));

/** What `readFormBody` produces for experiments/m10-vertical-slice/m10-gate-form.xml. */
const M10_BODY = {
  slots: [
    {
      reference: '/data/specimen',
      compositionId: null,
      resource: 'segment_and_measure_v1.gather',
      controls: [
        { reference: '/data/specimen/image', nodeType: 'upload', gather: null },
        { reference: '/data/specimen/area', nodeType: 'input', gather: null },
        { reference: '/data/specimen/area_unit', nodeType: 'input', gather: null },
        { reference: '/data/specimen/model_id', nodeType: 'input', gather: null },
        { reference: '/data/specimen/model_revision', nodeType: 'input', gather: null },
      ],
    },
  ],
};

/** What Central's /fields returns for the same form. */
const M10_FIELDS = [
  { name: 'site_name', path: '/data/site_name', type: 'string' },
  { name: 'gather_resources', path: '/data/gather_resources', type: 'string' },
  { name: 'specimen', path: '/data/specimen', type: 'structure' },
  { name: 'image', path: '/data/specimen/image', type: 'binary', binary: true },
  { name: 'area', path: '/data/specimen/area', type: 'decimal' },
  { name: 'area_unit', path: '/data/specimen/area_unit', type: 'string' },
  { name: 'model_id', path: '/data/specimen/model_id', type: 'string' },
  { name: 'model_revision', path: '/data/specimen/model_revision', type: 'string' },
  { name: 'instanceID', path: '/data/meta/instanceID', type: 'string' },
];

const slotsFor = (body = M10_BODY, fields = M10_FIELDS) => compositionSlotsFrom({ body, fields });

test('a slot normalizes to its path, its artifact and its bindable children', () => {
  const { slots, problems } = slotsFor();
  assert.deepEqual(problems, []);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].path, '/data/specimen');
  assert.equal(slots[0].resource, 'segment_and_measure_v1.gather');
  assert.deepEqual(slots[0].fields.map((f) => f.name),
    ['image', 'area', 'area_unit', 'model_id', 'model_revision']);
});

test('types come from Central and the control decides media', () => {
  const [slot] = slotsFor().slots;
  const image = slot.fields.find((f) => f.name === 'image');
  const area = slot.fields.find((f) => f.name === 'area');
  assert.equal(image.nodeType, 'upload', 'the control, not the type, decides projection');
  assert.equal(image.valueType, 'binary');
  assert.equal(area.valueType, 'decimal', "Central resolved the bind, so this is the submission's type");
});

test('no candidate claims to know whether the form requires it', () => {
  // Requiredness is an evaluated XPath expression. Binding ORs the producer's
  // contract with the form's live one, and an authoring surface can only supply
  // the first honestly.
  for (const field of slotsFor().slots[0].fields) {
    assert.ok(!('required' in field), `${field.name} claimed a requiredness it cannot know`);
  }
});

test('the real Tool binds cleanly against the real form', () => {
  const [slot] = slotsFor().slots;
  const { bindings, problems } = bindCompositionOutputs({
    field: { reference: slot.path, candidates: slot.fields },
    definition: TOOL,
  });
  assert.deepEqual(problems, [], 'the M10 form is the one this Tool was accepted against');
  assert.deepEqual(bindings.map((b) => b.path),
    ['image', 'area', 'area_unit', 'model_id', 'model_revision']);
  const image = bindings.find((b) => b.path === 'image');
  assert.equal(image.projection, 'media');
  assert.equal(image.retention, 'discard', 'the XForm named a durable owner for these bytes');
  assert.equal(bindings.find((b) => b.path === 'area').projection, 'none');
});

test('an output with no question reports where it would have gone', () => {
  const trimmed = {
    slots: [{
      ...M10_BODY.slots[0],
      controls: M10_BODY.slots[0].controls.filter((c) => !c.reference.endsWith('model_revision')),
    }],
  };
  const [slot] = compositionSlotsFrom({ body: trimmed, fields: M10_FIELDS }).slots;
  const { problems } = bindCompositionOutputs({
    field: { reference: slot.path, candidates: slot.fields },
    definition: TOOL,
  });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_OUTPUT_UNBOUND');
  assert.match(problems[0].message, /model_revision/);
});

test('a decimal output accepts an int question, because narrowing is the author\'s call', () => {
  // SCALAR_COMPATIBILITY is compatibility, not equality: decimal → [decimal, int].
  const fields = M10_FIELDS.map((f) => (f.name === 'area' ? { ...f, type: 'int' } : f));
  const [slot] = slotsFor(M10_BODY, fields).slots;
  const { problems } = bindCompositionOutputs({
    field: { reference: slot.path, candidates: slot.fields },
    definition: TOOL,
  });
  assert.deepEqual(problems, []);
});

test('a string output refuses an int question', () => {
  const fields = M10_FIELDS.map((f) => (f.name === 'area_unit' ? { ...f, type: 'int' } : f));
  const [slot] = slotsFor(M10_BODY, fields).slots;
  const { problems } = bindCompositionOutputs({
    field: { reference: slot.path, candidates: slot.fields },
    definition: TOOL,
  });
  assert.deepEqual(problems.map((p) => p.code), ['GATHER_COMPOSITION_OUTPUT_TYPE_MISMATCH']);
});

test('bind::gather:output overrides the name match', () => {
  const renamed = {
    slots: [{
      ...M10_BODY.slots[0],
      controls: M10_BODY.slots[0].controls.map((c) =>
        c.reference.endsWith('area')
          ? { reference: '/data/specimen/surface', nodeType: 'input', gather: { output: 'area' } }
          : c),
    }],
  };
  const fields = M10_FIELDS.map((f) =>
    f.name === 'area' ? { name: 'surface', path: '/data/specimen/surface', type: 'decimal' } : f);
  const [slot] = compositionSlotsFrom({ body: renamed, fields }).slots;
  const { bindings, problems } = bindCompositionOutputs({
    field: { reference: slot.path, candidates: slot.fields },
    definition: TOOL,
  });
  assert.deepEqual(problems, []);
  assert.equal(bindings.find((b) => b.path === 'area').reference, '/data/specimen/surface');
});

test('a control the published schema does not list is reported, not bound', () => {
  const { problems } = compositionSlotsFrom({
    body: M10_BODY,
    fields: M10_FIELDS.filter((f) => f.name !== 'area'),
  });
  assert.deepEqual(problems.map((p) => p.code), ['GATHER_FORM_FIELD_NOT_IN_SCHEMA']);
});

test('a slot with no bindable children says so', () => {
  const empty = { slots: [{ ...M10_BODY.slots[0], controls: [] }] };
  const { problems } = compositionSlotsFrom({ body: empty, fields: M10_FIELDS });
  assert.deepEqual(problems.map((p) => p.code), ['GATHER_COMPOSITION_NO_BINDABLE_CHILDREN']);
});

// --- typed outputs ----------------------------------------------------------
// A2UI v0.9 declares no result schema of its own, so the contract is Gather's
// `result` block — which the canonical Tool has carried since M10. What was
// missing was a way to recover it from an authored document, which is what
// makes these checks real rather than skipped.

const capabilities = JSON.parse(readFileSync(read('../../apps/renderer/public/capabilities.json'), 'utf8')).capabilities;
const inspect = (composition) => inspectComposition({ composition, capabilities });

test('inspecting a whole composition recovers its declared output types', () => {
  const analysis = inspect(TOOL);
  assert.deepEqual(
    analysis.result.outputs.map((output) => `${output.path}:${output.type}`),
    ['image:object', 'area:decimal', 'area_unit:string', 'model_id:string', 'model_revision:string']
  );
  assert.deepEqual(analysis.undeclaredOutputs, []);
});

test('a composition that declares no result reports no contract, not an empty one', () => {
  // "Not declared" and "declared compatible" are different claims, and binding
  // treats an untyped output as projectable anywhere. Collapsing them would
  // turn an unchecked Tool into a passing one.
  const { result, ...untyped } = TOOL;
  const analysis = inspect(untyped);
  assert.equal(analysis.result, null);
  assert.deepEqual(analysis.undeclaredOutputs, analysis.outputs);
});

test('a message list is refused where a composition belongs', () => {
  // The mistake that produced a package no device could load. Every step from
  // the Library draft to definitionLoader now says so rather than coping.
  assert.throws(() => inspect(TOOL.messages), (error) => {
    assert.equal(error.code, 'GATHER_NOT_A_COMPOSITION');
    assert.match(error.message, /message list, not a composition/);
    return true;
  });
});

test('declared types make the projectability check real', () => {
  const [slot] = slotsFor().slots;
  const { bindings, problems } = bindCompositionOutputs({
    field: { reference: slot.path, candidates: slot.fields },
    definition: { result: inspect(TOOL).result },
  });
  assert.deepEqual(problems, []);
  assert.equal(bindings.length, 5);
  assert.equal(bindings.find((b) => b.path === 'image').projection, 'media');
});

test('a declared object output cannot be written to a scalar question', () => {
  // The image is an asset. Reaching a plain <input> it would be stringified
  // into the submission, which nobody would notice until they read the data.
  const scalarImage = {
    slots: [{
      ...M10_BODY.slots[0],
      controls: M10_BODY.slots[0].controls.map((c) =>
        c.reference.endsWith('/image') ? { ...c, nodeType: 'input' } : c),
    }],
  };
  const fields = M10_FIELDS.map((f) =>
    f.name === 'image' ? { name: 'image', path: '/data/specimen/image', type: 'string' } : f);
  const [slot] = compositionSlotsFrom({ body: scalarImage, fields }).slots;
  const { problems } = bindCompositionOutputs({
    field: { reference: slot.path, candidates: slot.fields },
    definition: { result: inspect(TOOL).result },
  });
  assert.deepEqual(problems.map((p) => p.code), ['GATHER_COMPOSITION_OUTPUT_TYPE_MISMATCH']);
});

test('a string output declared into an int question is a real mismatch', () => {
  const fields = M10_FIELDS.map((f) => (f.name === 'area_unit' ? { ...f, type: 'int' } : f));
  const [slot] = slotsFor(M10_BODY, fields).slots;
  const { problems } = bindCompositionOutputs({
    field: { reference: slot.path, candidates: slot.fields },
    definition: { result: inspect(TOOL).result },
  });
  assert.deepEqual(problems.map((p) => p.code), ['GATHER_COMPOSITION_OUTPUT_TYPE_MISMATCH']);
  assert.match(problems[0].message, /area_unit/);
});

test('without a declared contract the same mismatch goes unreported', () => {
  // Exactly the failure the caveat in Review is about: an untyped draft binds
  // cleanly against a form it would corrupt.
  const fields = M10_FIELDS.map((f) => (f.name === 'area_unit' ? { ...f, type: 'int' } : f));
  const [slot] = slotsFor(M10_BODY, fields).slots;
  const { result, ...untyped } = TOOL;
  const analysis = inspect(untyped);
  const { problems } = bindCompositionOutputs({
    field: { reference: slot.path, candidates: slot.fields },
    definition: { result: { outputs: analysis.outputs.map((path) => ({ path })) } },
  });
  assert.deepEqual(problems, [], 'an untyped output is projectable anywhere, by design');
});
