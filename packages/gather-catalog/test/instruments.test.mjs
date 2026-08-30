import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { GATHER_CATALOG_ID, SEGMENT_AND_MEASURE_INSTRUMENT } from '../src/index.js';

const findMessage = (messages, key) => messages.find((m) => key in m)[key];

// Component props that matter for cross-authoring equivalence: the component
// type and its bindings/statePath, not presentational fields like `variant`.
const normalizeComponents = (updateComponents) => {
  const map = {};
  for (const { id, component, variant, text, children, ...bindings } of updateComponents.components) {
    map[id] = { component, children, bindings };
  }
  return map;
};

test('Composer-authored instrument matches the hand-authored definition', async () => {
  const composer = JSON.parse(
    await readFile(new URL('../instruments/segment-and-measure.composer.json', import.meta.url)),
  );

  const composerCreate = findMessage(composer.messages, 'createSurface');
  const ourCreate = findMessage(SEGMENT_AND_MEASURE_INSTRUMENT.messages, 'createSurface');

  // Same catalog and data-model contract, regardless of surfaceId.
  assert.equal(composerCreate.catalogId, GATHER_CATALOG_ID);
  assert.equal(composerCreate.catalogId, ourCreate.catalogId);

  const composerComponents = normalizeComponents(findMessage(composer.messages, 'updateComponents'));
  const ourComponents = normalizeComponents(findMessage(SEGMENT_AND_MEASURE_INSTRUMENT.messages, 'updateComponents'));
  assert.deepEqual(composerComponents, ourComponents);

  const composerData = findMessage(composer.messages, 'updateDataModel');
  const ourData = findMessage(SEGMENT_AND_MEASURE_INSTRUMENT.messages, 'updateDataModel');
  assert.deepEqual(composerData.value, ourData.value);
  assert.equal(composerData.path, ourData.path);
});
