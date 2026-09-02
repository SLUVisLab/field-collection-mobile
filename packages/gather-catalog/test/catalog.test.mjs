import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  GATHER_ACTION_IDS,
  GATHER_CATALOG_ID,
  GATHER_CATALOG_REVISION,
  GATHER_COMPONENT_IDS,
  SEGMENT_AND_MEASURE_INSTRUMENT,
} from '../src/index.js';

test('Gather catalog contract has stable versioned identifiers', () => {
  assert.equal(GATHER_CATALOG_ID, 'https://gather.slu.edu/a2ui/catalogs/v0.1.json');
  assert.equal(GATHER_CATALOG_REVISION, '0.1.0');
  assert.equal(GATHER_COMPONENT_IDS.capture, 'GatherCapture');
  assert.equal(GATHER_COMPONENT_IDS.flow, 'Flow');
  assert.equal(GATHER_COMPONENT_IDS.imageOverlay, 'ImageOverlay');
  assert.equal(GATHER_COMPONENT_IDS.outputReview, 'OutputReview');
  assert.equal(GATHER_COMPONENT_IDS.processingView, 'ProcessingView');
  assert.equal(GATHER_COMPONENT_IDS.instrumentError, 'InstrumentError');
  assert.equal(GATHER_COMPONENT_IDS.mediaGallery, 'MediaGallery');
  assert.equal(GATHER_COMPONENT_IDS.multiImageCapture, 'MultiImageCapture');
  assert.equal(GATHER_ACTION_IDS.mediaCaptured, 'gather.mediaCaptured');
  assert.equal(GATHER_ACTION_IDS.mediaChanged, 'gather.mediaChanged');
  assert.equal(GATHER_ACTION_IDS.capture, 'gather.capture');
  assert.equal(GATHER_ACTION_IDS.accept, 'gather.accept');
  assert.equal(GATHER_ACTION_IDS.retake, 'gather.retake');
  assert.equal(GATHER_ACTION_IDS.submit, 'gather.submit');
  assert.ok(!('advance' in GATHER_ACTION_IDS), 'generic advance/back replaced by specific actions');
  assert.ok(!('phaseView' in GATHER_COMPONENT_IDS), 'no conditional-rendering gate component');
  assert.equal(SEGMENT_AND_MEASURE_INSTRUMENT.catalogId, GATHER_CATALOG_ID);
  // Segment & Measure declares the actions it uses — not every action in the
  // catalog. Collection actions belong to MediaGallery / MultiImageCapture.
  const catalogActions = new Set(Object.values(GATHER_ACTION_IDS));
  for (const id of SEGMENT_AND_MEASURE_INSTRUMENT.hostActions) {
    assert.ok(catalogActions.has(id), `${id} is not a catalog action`);
  }
  assert.ok(SEGMENT_AND_MEASURE_INSTRUMENT.hostActions.includes(GATHER_ACTION_IDS.accept));
  assert.ok(SEGMENT_AND_MEASURE_INSTRUMENT.hostActions.includes(GATHER_ACTION_IDS.submit));
});

test('assembled catalog covers each Gather component with freestanding schemas', async () => {
  const catalog = JSON.parse(await readFile(new URL('../catalogs/gather-v0.1.json', import.meta.url)));

  assert.equal(catalog.catalogId, GATHER_CATALOG_ID);
  for (const componentId of Object.values(GATHER_COMPONENT_IDS)) {
    assert.ok(catalog.components[componentId]);
  }
  assert.ok(catalog.components.Column);
  assert.ok(catalog.components.Text);
  assert.match(JSON.stringify(catalog), /#\/\$defs\/common_types_/);
});
