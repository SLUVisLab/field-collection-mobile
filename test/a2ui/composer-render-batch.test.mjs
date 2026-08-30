import assert from 'node:assert/strict';
import test from 'node:test';

import { Catalog } from '@a2ui/web_core/v0_9/catalog';
import { MessageProcessor } from '@a2ui/web_core/v0_9/processor';

import { applyRenderBatch } from '../../apps/renderer/src/renderBatch.js';

const makeProcessor = () => {
  const catalog = new Catalog('cat1', [], []);
  return new MessageProcessor([catalog], () => {});
};

const renderBatch = [
  { version: 'v0.9', createSurface: { surfaceId: 'gallery-preview', catalogId: 'cat1', sendDataModel: true } },
];

test('applyRenderBatch renders a fresh surface', () => {
  const processor = makeProcessor();
  applyRenderBatch(processor, renderBatch);
  assert.deepEqual([...processor.model.surfacesMap.keys()], ['gallery-preview']);
});

test('applyRenderBatch is idempotent when Composer re-sends createSurface', () => {
  const processor = makeProcessor();
  applyRenderBatch(processor, renderBatch);
  // A second identical render must not throw "Surface already exists".
  assert.doesNotThrow(() => applyRenderBatch(processor, renderBatch));
  assert.deepEqual([...processor.model.surfacesMap.keys()], ['gallery-preview']);
});

test('raw processMessages still throws on duplicate (guards the regression)', () => {
  const processor = makeProcessor();
  applyRenderBatch(processor, renderBatch);
  assert.throws(() => processor.processMessages(renderBatch), /already exists/);
});
