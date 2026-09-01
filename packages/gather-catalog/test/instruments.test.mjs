import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  GATHER_ACTION_IDS,
  GATHER_CATALOG_ID,
  GATHER_COMPONENT_IDS,
  SEGMENT_AND_MEASURE_INSTRUMENT,
} from '../src/index.js';

const findMessage = (messages, key) => messages.find((m) => key in m)[key];
const components = () => findMessage(SEGMENT_AND_MEASURE_INSTRUMENT.messages, 'updateComponents').components;
const initialState = () => findMessage(SEGMENT_AND_MEASURE_INSTRUMENT.messages, 'updateDataModel').value;

// Component props that matter for cross-authoring equivalence: the component
// type and its bindings/children, not presentational fields like `variant`/`text`.
const normalizeComponents = (updateComponents) => {
  const map = {};
  for (const { id, component, variant, text, children, ...bindings } of updateComponents.components) {
    map[id] = { component, children, bindings };
  }
  return map;
};

// The checked-in Composer bundle was authored against an earlier tree, so it can
// no longer be equivalent to the definition. It is retained as the historical
// record of that verified session and must be re-authored in the hosted Composer
// against the current Flow-based tree rather than hand-edited, or it stops being
// evidence.
test(
  'Composer-authored instrument matches the hand-authored definition',
  { skip: 'Requires re-authoring in hosted Composer against the current Flow-based tree.' },
  async () => {
    const composer = JSON.parse(
      await readFile(new URL('../instruments/segment-and-measure.composer.json', import.meta.url)),
    );
    const composerCreate = findMessage(composer.messages, 'createSurface');
    const ourCreate = findMessage(SEGMENT_AND_MEASURE_INSTRUMENT.messages, 'createSurface');
    assert.equal(composerCreate.catalogId, GATHER_CATALOG_ID);
    assert.equal(composerCreate.catalogId, ourCreate.catalogId);
    assert.deepEqual(
      normalizeComponents(findMessage(composer.messages, 'updateComponents')),
      normalizeComponents(findMessage(SEGMENT_AND_MEASURE_INSTRUMENT.messages, 'updateComponents')),
    );
  },
);

test('every authored component id is unique and every child/View reference resolves', () => {
  const tree = components();
  const ids = tree.map((component) => component.id);
  assert.equal(ids.length, new Set(ids).size, 'component ids must be unique');
  const byId = new Map(tree.map((component) => [component.id, component]));

  for (const component of tree) {
    for (const childId of component.children ?? []) {
      assert.ok(byId.has(childId), `${component.id} references missing child '${childId}'`);
    }
    if (typeof component.child === 'string') {
      assert.ok(byId.has(component.child), `${component.id} references missing child '${component.child}'`);
    }
    for (const entry of component.views ?? []) {
      assert.ok(byId.has(entry.view), `${component.id} references missing View '${entry.view}'`);
    }
    if (typeof component.fallback === 'string') {
      assert.ok(byId.has(component.fallback), `${component.id} references missing fallback '${component.fallback}'`);
    }
  }
});

test('exactly one Flow selects the View by /gather/status, and no legacy gating remains', () => {
  const tree = components();
  const flows = tree.filter((component) => component.component === GATHER_COMPONENT_IDS.flow);
  assert.equal(flows.length, 1, 'the instrument composes exactly one Flow');

  const [flow] = flows;
  assert.equal(flow.current.path, '/gather/status');
  assert.ok(Array.isArray(flow.views) && flow.views.length >= 1);
  assert.ok(!('steps' in flow), 'Flow children are Views, not Steps');
  assert.equal(flow.fallback, 'captureView');

  // No component gates a subtree with a top-level `when`, and the retired
  // conditional/composite components are gone.
  for (const component of tree) {
    assert.ok(!('when' in component), `${component.id} gates structure with a top-level 'when'`);
    assert.notEqual(component.component, 'PhaseView');
    assert.notEqual(component.component, 'MaskReview');
  }

  // Root mounts only the Flow; every status the adapter can write selects a view.
  const root = tree.find((component) => component.id === 'root');
  assert.deepEqual(root.children, ['flow']);
  for (const status of ['capture', 'persisting-capture', 'segmenting', 'classifying', 'measuring', 'review-mask', 'accepted', 'error']) {
    assert.ok(flow.views.some((entry) => entry.when === status), `no Flow View for status '${status}'`);
  }
});

test('actions are real upstream Buttons carrying distinct, specific action names', () => {
  const byId = new Map(components().map((component) => [component.id, component]));
  const buttons = components().filter((component) => component.component === 'Button');
  const allowed = [GATHER_ACTION_IDS.accept, GATHER_ACTION_IDS.retake, GATHER_ACTION_IDS.submit];

  // Availability comes from being mounted in the active view, not from a disabled
  // `checks` flag, and there is no generic advance/back indirection.
  for (const button of buttons) {
    assert.ok(!('checks' in button), `${button.id} should not gate availability with checks`);
    assert.ok(allowed.includes(button.action.event.name), `${button.id} has unexpected action`);
  }

  assert.equal(byId.get('acceptMaskButton').action.event.name, GATHER_ACTION_IDS.accept);
  assert.equal(byId.get('submitButton').action.event.name, GATHER_ACTION_IDS.submit);
  assert.equal(byId.get('reviewRetakeButton').action.event.name, GATHER_ACTION_IDS.retake);
  assert.equal(byId.get('summaryRetakeButton').action.event.name, GATHER_ACTION_IDS.retake);
});

test('initial data model seeds every bound path and starts at status capture', () => {
  const state = initialState();
  const bound = new Set();
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.path === 'string') bound.add(value.path);
    for (const nested of Object.values(value)) collect(nested);
  };
  collect(components());

  for (const path of bound) {
    const key = path.replace('/gather/', '');
    assert.ok(key in state, `bound path '${path}' is not seeded in the initial data model`);
  }
  assert.equal(state.status, 'capture');
  assert.ok(!('phase' in state), 'the data model uses status, not phase');
});
