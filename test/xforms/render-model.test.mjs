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
