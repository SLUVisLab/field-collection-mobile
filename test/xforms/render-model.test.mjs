import test from 'node:test';
import assert from 'node:assert/strict';

import {
  controlKindFor,
  outlineFor,
  visibleRenderNodes,
} from '../../src/xforms/renderModel.js';

const choice = {
  reference: '/data/plant',
  nodeType: 'select',
  selectType: 'select1',
  label: 'Select plant',
  depth: 1,
  choices: [
    { label: 'Plant A', value: '0ede576e-04a4-4266-8450-6d9a8cd24164' },
    { label: 'Plant B', value: '7376ad33-c362-40d9-b657-be0a14649131' },
  ],
};

test('renderer classifications cover Silphium control surface without XML parsing', () => {
  assert.equal(controlKindFor({ nodeType: 'input', valueType: 'string' }), 'text');
  assert.equal(controlKindFor({ nodeType: 'input', valueType: 'int' }), 'int');
  assert.equal(controlKindFor({ nodeType: 'input', valueType: 'decimal' }), 'decimal');
  assert.equal(controlKindFor({ nodeType: 'note' }), 'note');
  assert.equal(controlKindFor({ nodeType: 'group' }), 'group');
  assert.equal(controlKindFor({ nodeType: 'model-value' }), 'calculate');
  assert.equal(controlKindFor({ nodeType: 'repeat-range:uncontrolled' }), 'repeat');
  assert.equal(
    controlKindFor({ nodeType: 'upload', valueType: 'binary', mediaType: 'image' }),
    'image-upload'
  );
  assert.equal(controlKindFor({ nodeType: 'upload', valueType: 'binary', mediaType: 'audio' }), 'unsupported');
});

test('visible controls and outline preserve engine render order and relevance', () => {
  const renderModel = {
    nodes: [
      { reference: '/data', nodeType: 'root', label: null, depth: 0 },
      choice,
      { reference: '/data/site', nodeType: 'model-value', label: 'Site', depth: 1 },
      { reference: '/data/hidden', nodeType: 'input', valueType: 'string', label: 'Hidden', depth: 1 },
    ],
  };
  const snapshot = {
    nodesByReference: {
      '/data/plant': { relevant: true },
      '/data/site': { relevant: true },
      '/data/hidden': { relevant: false },
    },
  };
  assert.deepEqual(
    visibleRenderNodes(renderModel, snapshot).map((node) => node.reference),
    ['/data/plant', '/data/site']
  );
  assert.deepEqual(
    outlineFor(renderModel, snapshot).map((entry) => entry.reference),
    ['/data/plant', '/data/site']
  );
});

test('a collection field owns its whole subtree', () => {
  // The interactive camera gate found the generic repeat controls rendering the
  // instances a second time underneath MultiImageCapture.
  const renderModel = {
    nodes: [
      { reference: '/data/note', nodeType: 'input', valueType: 'string' },
      {
        reference: '/data/photos',
        nodeType: 'repeat-range:uncontrolled',
        appearances: ['gather-multi-image', 'min=2'],
      },
      { reference: '/data/photos[1]', nodeType: 'repeat-instance' },
      { reference: '/data/photos[1]/frame', nodeType: 'upload', valueType: 'binary', mediaType: 'image' },
      { reference: '/data/photos[2]', nodeType: 'repeat-instance' },
      { reference: '/data/photos[2]/frame', nodeType: 'upload', valueType: 'binary', mediaType: 'image' },
    ],
  };

  assert.deepEqual(
    visibleRenderNodes(renderModel, null).map((node) => node.reference),
    ['/data/note', '/data/photos']
  );
});

test('an ordinary repeat still renders its instances', () => {
  // The suppression must be scoped to collection fields only.
  const renderModel = {
    nodes: [
      { reference: '/data/remarks', nodeType: 'repeat-range:uncontrolled' },
      { reference: '/data/remarks[1]', nodeType: 'repeat-instance' },
      { reference: '/data/remarks[1]/remark', nodeType: 'input', valueType: 'string' },
    ],
  };

  assert.equal(visibleRenderNodes(renderModel, null).length, 3);
});

test('a collection field does not suppress a similarly-named sibling repeat', () => {
  const renderModel = {
    nodes: [
      {
        reference: '/data/photos',
        nodeType: 'repeat-range:uncontrolled',
        appearances: ['gather-multi-image'],
      },
      { reference: '/data/photos[1]', nodeType: 'repeat-instance' },
      // `/data/photos_notes` shares a prefix but is a different node.
      { reference: '/data/photos_notes', nodeType: 'repeat-range:uncontrolled' },
      { reference: '/data/photos_notes[1]', nodeType: 'repeat-instance' },
    ],
  };

  assert.deepEqual(
    visibleRenderNodes(renderModel, null).map((node) => node.reference),
    ['/data/photos', '/data/photos_notes', '/data/photos_notes[1]']
  );
});

test('a group carrying the composition appearance dispatches to a composition', () => {
  assert.equal(
    controlKindFor({ nodeType: 'group', appearances: ['gather-composition:flower_v1'] }),
    'composition'
  );
  // Additive: an ordinary group, and a group with other tokens, are unchanged.
  assert.equal(controlKindFor({ nodeType: 'group', appearances: [] }), 'group');
  assert.equal(controlKindFor({ nodeType: 'group', appearances: ['field-list'] }), 'group');
  // A token naming no composition leaves the group ordinary.
  assert.equal(controlKindFor({ nodeType: 'group', appearances: ['gather-composition:'] }), 'group');
});

test('a composition group owns its subtree — children have no repeat index', () => {
  // The predicate differs from a collection field's: a composition group's
  // children are /data/flower/petal_count, with no `[n]`. Verified in
  // experiments/composition-appearance/.
  const renderModel = {
    nodes: [
      { reference: '/data/site', nodeType: 'input', valueType: 'string' },
      { reference: '/data/flower', nodeType: 'group', appearances: ['gather-composition:flower_v1'] },
      { reference: '/data/flower/petal_count', nodeType: 'input', valueType: 'int' },
      { reference: '/data/flower/color', nodeType: 'input', valueType: 'string' },
    ],
  };

  assert.deepEqual(
    visibleRenderNodes(renderModel, null).map((node) => node.reference),
    ['/data/site', '/data/flower']
  );
});

test('a composition does not suppress a similarly-named sibling group', () => {
  const renderModel = {
    nodes: [
      { reference: '/data/flower', nodeType: 'group', appearances: ['gather-composition:c'] },
      { reference: '/data/flower/x', nodeType: 'input', valueType: 'string' },
      // Shares a prefix but is a different node.
      { reference: '/data/flower_notes', nodeType: 'group', appearances: [] },
      { reference: '/data/flower_notes/y', nodeType: 'input', valueType: 'string' },
    ],
  };

  assert.deepEqual(
    visibleRenderNodes(renderModel, null).map((node) => node.reference),
    ['/data/flower', '/data/flower_notes', '/data/flower_notes/y']
  );
});

test('an outer composition suppresses a nested owning control too', () => {
  // The whole subtree belongs to the composition, including a collection field
  // inside it — otherwise a repeat would render loose under the placeholder.
  const renderModel = {
    nodes: [
      { reference: '/data/flower', nodeType: 'group', appearances: ['gather-composition:c'] },
      {
        reference: '/data/flower/photos',
        nodeType: 'repeat-range:uncontrolled',
        appearances: ['gather-multi-image'],
      },
      { reference: '/data/flower/photos[1]', nodeType: 'repeat-instance' },
    ],
  };

  assert.deepEqual(
    visibleRenderNodes(renderModel, null).map((node) => node.reference),
    ['/data/flower']
  );
});

test('a collection field and a composition can own subtrees in the same form', () => {
  const renderModel = {
    nodes: [
      { reference: '/data/photos', nodeType: 'repeat-range:uncontrolled', appearances: ['gather-multi-image'] },
      { reference: '/data/photos[1]', nodeType: 'repeat-instance' },
      { reference: '/data/flower', nodeType: 'group', appearances: ['gather-composition:c'] },
      { reference: '/data/flower/x', nodeType: 'input', valueType: 'string' },
      { reference: '/data/note', nodeType: 'input', valueType: 'string' },
    ],
  };

  assert.deepEqual(
    visibleRenderNodes(renderModel, null).map((node) => node.reference),
    ['/data/photos', '/data/flower', '/data/note']
  );
});
