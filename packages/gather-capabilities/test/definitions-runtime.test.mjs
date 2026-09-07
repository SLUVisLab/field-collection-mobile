import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPABILITY_DEFINITIONS,
  capabilityDefinitionsById,
  describeCapabilities,
  capabilityIds,
} from '../src/definitions.js';
import { createCapabilityRuntime } from '../src/runtime.js';
import { IMAGE_TASK_PROFILES } from '../src/contracts.js';

const EXPECTED_IDS = [
  'image.segment',
  'image.classify',
  'measure.area',
  'measure.perimeter',
  'measure.boundingBox',
  'measure.centroid',
  'measure.color',
  'measure.sharpness',
];

test('definitions advertise exactly the implemented capabilities', () => {
  assert.deepEqual(capabilityIds().sort(), [...EXPECTED_IDS].sort());
  for (const id of EXPECTED_IDS) {
    assert.ok(capabilityDefinitionsById[id], `missing definition ${id}`);
  }
});

test('describeCapabilities is Composer-safe: plain metadata, no functions or schemas', () => {
  const described = describeCapabilities();
  assert.equal(described.length, CAPABILITY_DEFINITIONS.length);
  for (const d of described) {
    assert.equal(typeof d.id, 'string');
    assert.ok(!('input' in d) && !('output' in d), 'descriptor must not carry schemas');
    for (const value of Object.values(d)) assert.notEqual(typeof value, 'function');
  }
});

test('image definitions declare inference metadata', () => {
  assert.equal(capabilityDefinitionsById['image.segment'].kind, 'inference');
  assert.equal(capabilityDefinitionsById['image.segment'].group, 'Image');
  assert.equal(capabilityDefinitionsById['image.classify'].group, 'Image');
});

test('runtime binds injected engines and keys match the advertised ids', async () => {
  const calls = [];
  const runtime = createCapabilityRuntime({
    segmentExecute: async ({ image }) => { calls.push(['seg', image.assetId]); return { mask: { path: 'm', width: 1, height: 1, assetId: 'm1' } }; },
    classifyExecute: async () => ({ ranked: [{ label: 'a', score: 1 }] }),
    measurementAdapter: {
      maskMeasurements: () => ({ area: { value: 5, unit: 'px2' } }),
      imageMeasurements: () => ({ color: {}, sharpness: {} }),
    },
  });

  assert.deepEqual(Object.keys(runtime).sort(), [...EXPECTED_IDS].sort(), 'runtime keys == advertised ids');

  const segResult = await runtime['image.segment']({
    image: { assetId: 'image-1', path: 'i.jpg' },
    model: {},
    modelRef: { id: 'u', version: '1', revision: 'sha256:x', taskProfile: IMAGE_TASK_PROFILES.segmentationBinary },
  });
  assert.equal(segResult.mask.assetId, 'm1');
  assert.deepEqual(calls, [['seg', 'image-1']]);

  const areaResult = await runtime['measure.area']({ mask: { path: 'm', width: 1, height: 1 } });
  assert.deepEqual(areaResult, { value: 5, unit: 'px2' });
});
