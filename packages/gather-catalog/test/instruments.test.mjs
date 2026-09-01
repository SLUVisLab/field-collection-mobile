import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  GATHER_ACTION_IDS,
  GATHER_CATALOG_ID,
  SEGMENT_AND_MEASURE_INSTRUMENT,
  SEGMENT_AND_MEASURE_PRESENTATION,
  segmentAndMeasurePresentation,
} from '../src/index.js';

const findMessage = (messages, key) => messages.find((m) => key in m)[key];
const components = () => findMessage(SEGMENT_AND_MEASURE_INSTRUMENT.messages, 'updateComponents').components;
const initialState = () => findMessage(SEGMENT_AND_MEASURE_INSTRUMENT.messages, 'updateDataModel').value;

// Component props that matter for cross-authoring equivalence: the component
// type and its bindings/statePath, not presentational fields like `variant`.
const normalizeComponents = (updateComponents) => {
  const map = {};
  for (const { id, component, variant, text, children, ...bindings } of updateComponents.components) {
    map[id] = { component, children, bindings };
  }
  return map;
};

// The checked-in Composer bundle was authored against the previous
// PhaseView-gated tree, so it can no longer be equivalent to the definition and
// no longer validates against the catalog (PhaseView was removed). The fixture
// is retained as the historical record of that verified authoring session. This
// assertion stays skipped until the current tree is re-authored in the hosted
// Composer and the fixture is replaced from that session -- it must not be
// hand-edited, or it stops being evidence.
test(
  'Composer-authored instrument matches the hand-authored definition',
  { skip: 'Requires re-authoring in hosted Composer against the stable-skeleton tree.' },
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

test('Segment & Measure renders one stable tree with no structural phase gating', () => {
  const tree = components();
  const byId = new Map(tree.map((component) => [component.id, component]));

  // A2UI has no conditional-rendering primitive in v0.9 or v1.0. The tree must
  // therefore never gate structure: no component selects a subtree by phase.
  for (const component of tree) {
    assert.ok(!('when' in component), `${component.id} gates structure with 'when'`);
    assert.notEqual(component.component, 'PhaseView');
    assert.notEqual(component.component, 'MaskReview');
  }

  // Exactly one container, and every referenced child id resolves.
  const containers = tree.filter((component) => Array.isArray(component.children));
  assert.equal(containers.length, 1);
  assert.equal(containers[0].id, 'root');
  for (const component of tree) {
    for (const childId of component.children ?? []) {
      assert.ok(byId.has(childId), `root references missing child '${childId}'`);
    }
    if (typeof component.child === 'string') {
      assert.ok(byId.has(component.child), `${component.id} references missing child '${component.child}'`);
    }
  }
});

test('one primary/secondary action pair carries every phase transition', () => {
  const byId = new Map(components().map((component) => [component.id, component]));
  const buttons = components().filter((component) => component.component === 'Button');
  assert.equal(buttons.length, 2);

  const primary = byId.get('primaryAction');
  const secondary = byId.get('secondaryAction');
  assert.equal(primary.action.event.name, GATHER_ACTION_IDS.advance);
  assert.equal(secondary.action.event.name, GATHER_ACTION_IDS.back);

  // Availability is expressed with `checks`, which upstream GenericBinder turns
  // into the `isValid` flag the Button binding maps to a disabled state. That is
  // how a phase disables an action without removing it from the tree.
  assert.deepEqual(primary.checks.map((check) => check.condition.path), ['/gather/canAdvance']);
  assert.deepEqual(secondary.checks.map((check) => check.condition.path), ['/gather/canGoBack']);

  // Labels are bound, not baked in, so one button serves every phase.
  assert.equal(byId.get(primary.child).text.path, '/gather/primaryLabel');
  assert.equal(byId.get(secondary.child).text.path, '/gather/secondaryLabel');
});

test('every phase supplies each bound presentation value the tree reads', () => {
  const boundKeys = ['statusText', 'primaryLabel', 'secondaryLabel', 'canAdvance', 'canGoBack'];

  for (const [phase, presentation] of Object.entries(SEGMENT_AND_MEASURE_PRESENTATION)) {
    for (const key of boundKeys) {
      assert.ok(key in presentation, `phase '${phase}' is missing '${key}'`);
    }
    assert.equal(typeof presentation.statusText, 'string');
    assert.equal(typeof presentation.canAdvance, 'boolean');
    assert.equal(typeof presentation.canGoBack, 'boolean');
  }

  // Only the review and accepted phases may advance; processing phases must not.
  assert.equal(SEGMENT_AND_MEASURE_PRESENTATION['review-mask'].canAdvance, true);
  assert.equal(SEGMENT_AND_MEASURE_PRESENTATION.accepted.canAdvance, true);
  for (const phase of ['capture', 'persisting-capture', 'segmenting', 'classifying', 'measuring', 'error']) {
    assert.equal(SEGMENT_AND_MEASURE_PRESENTATION[phase].canAdvance, false, `${phase} must not advance`);
  }

  // An unknown phase degrades to the capture presentation rather than leaving
  // the bound values undefined, which would render blank labels.
  assert.deepEqual(segmentAndMeasurePresentation('nonsense'), SEGMENT_AND_MEASURE_PRESENTATION.capture);
  assert.deepEqual(segmentAndMeasurePresentation(undefined), SEGMENT_AND_MEASURE_PRESENTATION.capture);
});

test('initial data model seeds every path the tree binds', () => {
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
  assert.equal(state.phase, 'capture');
  assert.equal(state.canAdvance, false);
});
