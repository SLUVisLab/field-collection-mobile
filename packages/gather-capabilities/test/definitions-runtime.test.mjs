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

test('image capabilities declare which model profiles they accept', () => {
  // Machine-readable, so Composer filtering, default-model validation and the
  // implementation's own guard all read one list instead of three constants.
  assert.deepEqual(capabilityDefinitionsById['image.segment'].acceptedModelProfiles, [
    IMAGE_TASK_PROFILES.segmentationBinary,
  ]);
  assert.deepEqual(capabilityDefinitionsById['image.classify'].acceptedModelProfiles, [
    IMAGE_TASK_PROFILES.classificationRanked,
  ]);
  // A capability that takes no model says so by declaring none.
  assert.deepEqual(capabilityDefinitionsById['measure.area'].acceptedModelProfiles, []);
  // And it reaches the Composer descriptor.
  assert.deepEqual(capabilityDefinitionsById['image.segment'].describe().acceptedModelProfiles, [
    IMAGE_TASK_PROFILES.segmentationBinary,
  ]);
});

const segmentationRef = {
  id: 'u',
  version: '1',
  revision: `sha256:${'a'.repeat(64)}`,
  taskProfile: IMAGE_TASK_PROFILES.segmentationBinary,
};

const runtimeWith = (overrides = {}) => {
  const calls = [];
  const runtime = createCapabilityRuntime({
    segmentExecute: async ({ image, model }) => {
      calls.push(['seg', image.assetId, model?.identity?.id ?? null]);
      return { mask: { path: 'm', width: 1, height: 1, assetId: 'm1' } };
    },
    classifyExecute: async () => ({ ranked: [{ label: 'a', score: 1 }] }),
    measurementAdapter: {
      maskMeasurements: () => ({ area: { value: 5, unit: 'px2' } }),
      imageMeasurements: () => ({ color: {}, sharpness: {} }),
    },
    resolveModel: async ({ modelRef }) => ({
      model: { identity: { id: 'resolved-package' } },
      modelRef: modelRef ?? segmentationRef,
    }),
    ...overrides,
  });
  return { runtime, calls };
};

test('runtime binds injected engines and keys match the advertised ids', async () => {
  const { runtime, calls } = runtimeWith();
  assert.deepEqual(Object.keys(runtime).sort(), [...EXPECTED_IDS].sort(), 'runtime keys == advertised ids');

  const segResult = await runtime['image.segment']({
    image: { assetId: 'image-1', path: 'i.jpg' },
    modelRef: segmentationRef,
  });
  assert.equal(segResult.mask.assetId, 'm1');
  assert.deepEqual(calls, [['seg', 'image-1', 'resolved-package']]);

  const areaResult = await runtime['measure.area']({ mask: { path: 'm', width: 1, height: 1 } });
  assert.deepEqual(areaResult, { value: 5, unit: 'px2' });
});

test('a serialized ModelRef is resolved to a package before execution', async () => {
  // The defect this boundary exists to fix: the A2UI schema is
  // { image, modelRef }, and the engine needs a ModelPackage. Passing the
  // validated input straight through handed `execute` model: undefined.
  const seen = [];
  const { runtime } = runtimeWith({
    segmentExecute: async ({ model }) => {
      seen.push(model);
      return { mask: { assetId: 'm1' } };
    },
  });
  await runtime['image.segment']({ image: { assetId: 'image-1' }, modelRef: segmentationRef });
  assert.equal(seen.length, 1);
  assert.notEqual(seen[0], undefined, 'execute must receive a resolved package, not undefined');
  assert.equal(seen[0].identity.id, 'resolved-package');
});

test('an absent ModelRef is the app default, and the resolver is told which capability asked', async () => {
  // Workflow 1. The capability never chooses a model; it asks, and records
  // whatever comes back.
  const asked = [];
  const { runtime } = runtimeWith({
    resolveModel: async (input) => {
      asked.push(input);
      return { model: { identity: { id: 'default-package' } }, modelRef: segmentationRef };
    },
  });
  const result = await runtime['image.segment']({ image: { assetId: 'image-1' } });
  assert.deepEqual(asked, [
    {
      capabilityId: 'image.segment',
      acceptedModelProfiles: [IMAGE_TASK_PROFILES.segmentationBinary],
      modelRef: null,
    },
  ]);
  assert.deepEqual(result.model, segmentationRef, 'provenance carries the concrete ref either way');
});

test('an incompatible ModelRef is rejected before the engine runs', async () => {
  const ran = [];
  const { runtime } = runtimeWith({
    segmentExecute: async () => {
      ran.push(1);
      return { mask: {} };
    },
    resolveModel: async () => ({
      model: { identity: { id: 'wrong' } },
      modelRef: { ...segmentationRef, taskProfile: IMAGE_TASK_PROFILES.classificationRanked },
    }),
  });
  await assert.rejects(
    () => runtime['image.segment']({ image: { assetId: 'image-1' } }),
    (error) => {
      assert.equal(error.code, 'GATHER_IMAGE_UNSUPPORTED_PROFILE');
      return true;
    }
  );
  assert.deepEqual(ran, [], 'nothing executed');
});

test('a model-backed capability without a resolver fails loudly, not silently', async () => {
  // Previously this configuration produced model: undefined and an obscure
  // failure deep inside the executor.
  const runtime = createCapabilityRuntime({ segmentExecute: async () => ({ mask: {} }) });
  await assert.rejects(
    () => runtime['image.segment']({ image: { assetId: 'image-1' }, modelRef: segmentationRef }),
    (error) => {
      assert.equal(error.code, 'GATHER_CAPABILITY_NO_MODEL_RESOLVER');
      return true;
    }
  );
});

test('a resolver that produces nothing is a clear failure', async () => {
  const { runtime } = runtimeWith({ resolveModel: async () => ({}) });
  await assert.rejects(
    () => runtime['image.segment']({ image: { assetId: 'image-1' } }),
    (error) => {
      assert.equal(error.code, 'GATHER_CAPABILITY_MODEL_UNRESOLVED');
      return true;
    }
  );
});

test('measurement capabilities need no model resolver at all', async () => {
  const runtime = createCapabilityRuntime({
    measurementAdapter: { maskMeasurements: () => ({ area: { value: 5, unit: 'px2' } }) },
  });
  assert.deepEqual(await runtime['measure.area']({ mask: { path: 'm', width: 1, height: 1 } }), {
    value: 5,
    unit: 'px2',
  });
});
