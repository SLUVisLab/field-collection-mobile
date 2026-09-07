import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { digestBytes } from 'gather-hashing';
import { modelRevisionFor, validateModelPackage } from 'gather-models';

import { inspectComposition } from '../../src/authoring/inspectComposition.js';
import { createPackagedModelResolver } from '../../src/packaging/packagedModelResolver.js';
import { checkHostSupport, openTool, packTool } from '../../src/packaging/gatherPackage.js';
import { planPublication } from '../../src/packaging/publicationPlan.js';
import { previewModels } from '../../apps/renderer/src/preview/previewModels.js';

/** The artifacts that ship, so the package is exercised against the real Tool. */
const read = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const TOOL = JSON.parse(readFileSync(read(
  '../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json'), 'utf8'));
const capabilities = JSON.parse(readFileSync(read('../../apps/renderer/public/capabilities.json'), 'utf8')).capabilities;
const MODEL_DIR = read('../../apps/renderer/public/models/sha256-dcbe0ccd840f1290c3d4d9cc6e3071af0c3480751ef36fb861a9c757124cd55b');
const modelPackage = JSON.parse(readFileSync(`${MODEL_DIR}/model.json`, 'utf8'));
const artifactBytes = new Uint8Array(readFileSync(`${MODEL_DIR}/model.onnx`));

/** The smallest composition around a hand-built message list. */
const asComposition = (messages) =>
  Array.isArray(messages)
    ? { id: 'test.tool', catalogId: 'test', surfaceId: 'test', messages }
    : messages;

const analyse = (messages) =>
  inspectComposition({ composition: asComposition(messages), capabilities, models: previewModels });
const sources = () => new Map([[modelRevisionFor(modelPackage), { modelPackage, artifactBytes }]]);
const packCanonical = (extra = {}) => {
  const plan = planPublication({ analysis: analyse(TOOL), resolveDefault: () => null });
  return packTool({
    tool: { id: TOOL.id, revision: TOOL.revision, title: TOOL.title },
    composition: TOOL,
    plan,
    modelSources: sources(),
    builtAt: '2026-09-06T00:00:00.000Z',
    ...extra,
  });
};

test('the canonical Tool packs, and the same inputs give the same bytes', () => {
  const first = packCanonical();
  const second = packCanonical();
  assert.deepEqual([...first.bytes], [...second.bytes], 'packaging must be deterministic');
  assert.ok(first.bytes.byteLength > artifactBytes.byteLength, 'the model bytes travel with it');
});

test('the manifest freezes exactly what the Tool requires', () => {
  const { manifest } = packCanonical();
  assert.deepEqual(manifest.requires.capabilities, ['image.segment', 'measure.area']);
  // Host functions are recorded as host requirements, never as packaged deps.
  assert.deepEqual(manifest.requires.hostFunctions.sort(),
    ['gather_completeComposition', 'gather_persistAsset']);
  assert.equal(manifest.requires.models.length, 1);
  assert.equal(manifest.requires.models[0].modelRef.revision, modelRevisionFor(modelPackage));
  assert.deepEqual(manifest.outputs, ['image', 'area', 'area_unit', 'model_id', 'model_revision']);
});

test('nothing about a form or a Central project is in the package', () => {
  const { bytes } = packCanonical();
  const text = Buffer.from(bytes).toString('latin1');
  for (const forbidden of ['/data/specimen', 'gather_m10_vertical_slice', 'projectId', 'formId']) {
    assert.ok(!text.includes(forbidden), `the package leaked ${forbidden}`);
  }
});

test('it opens, verifies and yields the author\'s composition unchanged', () => {
  const { bytes } = packCanonical();
  const opened = openTool({ bytes, modelRevisionFor });
  assert.equal(opened.version, 2);
  assert.deepEqual(opened.composition, TOOL, 'the composition must survive byte for byte');
  const model = opened.models.get(modelRevisionFor(modelPackage));
  assert.ok(model);
  assert.equal(digestBytes(model.artifactBytes), modelPackage.artifact.sha256);
  validateModelPackage(model.modelPackage);
});

test('a v1 artifact still opens, unchanged', () => {
  // What M10 actually attached: the whole `.a2ui.json`, which is the form of a
  // v1 `.gather`. An earlier fixture here used the message list, which no
  // deployment has ever carried.
  const v1 = new TextEncoder().encode(JSON.stringify(TOOL, null, 2));
  const opened = openTool({ bytes: v1, modelRevisionFor });
  assert.equal(opened.version, 1);
  assert.deepEqual(opened.composition, TOOL);
});

test('a corrupted artifact byte is refused before anything is installed', () => {
  const { bytes } = packCanonical();
  const corrupted = Uint8Array.from(bytes);
  // Flip a byte inside the model payload, past the headers.
  corrupted[Math.floor(corrupted.length / 2)] ^= 0xff;
  assert.throws(() => openTool({ bytes: corrupted, modelRevisionFor }), /CRC|corrupt|mismatch/i);
});

test('a Tool whose model is chosen at run time cannot be published', () => {
  const dynamic = [
    {
      version: 'v0.9',
      updateComponents: {
        components: [
          { id: 'pick', action: { functionCall: { call: 'gather_persistAsset', args: { capture: {} } }, resultPath: '/working/m' } },
          { id: 'seg', action: { functionCall: { call: 'image_segment', args: { image: {}, modelRef: { path: '/working/m' } } } } },
          { id: 'done', action: { functionCall: { call: 'gather_completeComposition', args: { outputs: { a: {} } } } } },
        ],
      },
    },
    { version: 'v0.9', updateDataModel: { path: '/working', value: { m: previewModels[0].modelRef } } },
  ];
  assert.throws(
    () => planPublication({ analysis: analyse(dynamic), resolveDefault: () => null }),
    (error) => error.code === 'GATHER_PUBLISH_INDETERMINATE_MODEL'
  );
});

test('a host missing a called function is told which one', () => {
  const { manifest } = packCanonical();
  const result = checkHostSupport({
    manifest,
    capabilities: ['image.segment', 'measure.area'],
    hostFunctions: ['gather_completeComposition'],
  });
  assert.equal(result.supported, false);
  assert.deepEqual(result.missing, [{ kind: 'hostFunction', id: 'gather_persistAsset' }]);
});

// --- the test that proves the lock is real ---------------------------------
const defaultedTool = () => [
  {
    version: 'v0.9',
    updateComponents: {
      components: [
        { id: 'seg', action: { functionCall: { call: 'image_segment', args: { image: {} } } } },
        { id: 'done', action: { functionCall: { call: 'gather_completeComposition', args: { outputs: { a: {} } } } } },
      ],
    },
  },
];

test('a default frozen at publication survives a change of product policy', async () => {
  const modelA = previewModels.find((m) => m.taskProfile === 'segmentation.binary.v1').modelRef;
  const modelB = { ...modelA, id: 'later-default', revision: `sha256:${'b'.repeat(64)}` };

  // Published in September, when policy said A.
  const plan = planPublication({ analysis: analyse(defaultedTool()), resolveDefault: () => modelA });
  assert.equal(plan.modelResolutions.length, 1);
  assert.equal(plan.modelResolutions[0].modelRef.revision, modelA.revision);
  // The author's document is untouched: it still omits modelRef.
  const args = defaultedTool()[0].updateComponents.components[0].action.functionCall.args;
  assert.ok(!('modelRef' in args));

  // December: product policy now says B.
  const policyNowSaysB = async (input) => ({ model: {}, modelRef: input.modelRef ?? modelB });

  // An unpackaged draft follows current policy — which is correct for a draft.
  assert.equal((await policyNowSaysB({ capabilityId: 'image.segment' })).modelRef.revision, modelB.revision);

  // The package does not.
  const packaged = createPackagedModelResolver({
    manifest: { modelResolutions: plan.modelResolutions },
    resolve: policyNowSaysB,
  });
  const resolved = await packaged({ capabilityId: 'image.segment', acceptedModelProfiles: ['segmentation.binary.v1'] });
  assert.equal(resolved.modelRef.revision, modelA.revision, 'the packaged Tool must still run Model A');
});

test('a package that froze no resolution refuses to guess', async () => {
  const packaged = createPackagedModelResolver({
    manifest: { modelResolutions: [] },
    resolve: async () => ({ model: {}, modelRef: previewModels[0].modelRef }),
  });
  await assert.rejects(
    () => packaged({ capabilityId: 'image.segment' }),
    (error) => error.code === 'GATHER_PACKAGED_RESOLUTION_MISSING'
  );
});
