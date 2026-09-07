import assert from 'node:assert/strict';
import test from 'node:test';

import { Catalog } from '@a2ui/web_core/v0_9/catalog';
import {
  CAPABILITY_DEFINITIONS,
  capabilityDefinitionsById,
  createCapabilityRuntime,
} from 'gather-capabilities';
import { createModelRef, createModelStore } from 'gather-models';
import { digestBytes } from 'gather-hashing';

import { capabilityFunctions, a2uiFunctionId } from '../../src/a2ui/capabilityFunctions.js';
import { createExecutionReceipt } from '../../src/provenance/receipt.js';
import { buildModelCatalog, modelsForCapability } from '../../src/compute/models/modelCatalog.js';
import { defaultModelRefFor, bundledModelForRef } from '../../src/compute/models/modelPolicy.js';
import { BUNDLED_MODELS } from '../../src/compute/models/bundledModels.js';

/**
 * The two workflows that are actionable today, end to end:
 *
 *   1. capability default    image.segment(image)          → app default ModelRef
 *   2. explicit ModelRef     Composer picks a Gather model → authored FunctionCall
 *
 * Both go through the REAL registered A2UI function, the REAL capability
 * runtime, and a REAL model store over an in-memory filesystem. `segmentExecute`
 * is deliberately not stubbed away at the boundary under test: the point is that
 * the engine receives a resolved package rather than `undefined`, which is
 * exactly what no previous test could observe.
 */

const PROJECT = 'project-1';

const artifactBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

/** A minimal but genuinely valid segmentation package over known bytes. */
const segmentationPackage = () => ({
  identity: { id: 'test-segmenter', version: '1.0.0' },
  taskProfile: 'segmentation.binary.v1',
  artifact: { path: 'bundle/test.onnx', sha256: digestBytes(artifactBytes) },
  tensor: { inputName: 'image', inputShape: [1, 3, 8, 8], outputNames: ['mask'] },
  upstream: { project: 'test', revision: 'abc', license: 'Apache-2.0' },
  preprocessing: [{ operation: 'resize', width: 8, height: 8 }],
  postprocessing: [{ operation: 'sigmoid' }, { operation: 'threshold', value: 0.5 }, { operation: 'binaryMask' }],
});

const makeStore = () => {
  const files = new Map();
  const store = createModelStore({
    readBytes: async (key) => files.get(key),
    readText: async (key) => {
      const value = files.get(key);
      return value instanceof Uint8Array ? new TextDecoder().decode(value) : value;
    },
    writeBytesAtomic: async (key, bytes) => files.set(key, bytes),
    writeTextAtomic: async (key, text) => files.set(key, text),
    fileExists: async (key) => files.has(key),
    fileForKey: (key) => ({ uri: `file:///${key}`, path: key }),
    listDirectory: async (prefix) =>
      [...new Set([...files.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.split('/').slice(0, 4).join('/')))],
  });
  return { store, files };
};

/**
 * The app's model boundary, as `GatherProvider` wires it: a serialized ref — or
 * none, meaning the default — becomes the resolved descriptor, installing if
 * the bytes are not present yet.
 */
const makeResolver = ({ store, defaults }) => async ({ capabilityId, acceptedModelProfiles, modelRef }) => {
  const wanted = modelRef ?? defaults[capabilityId] ?? null;
  if (!wanted) throw new Error(`no model for ${capabilityId}`);
  if (acceptedModelProfiles?.length && !acceptedModelProfiles.includes(wanted.taskProfile)) {
    throw new Error(`incompatible default for ${capabilityId}`);
  }
  // Mirrors the real resolver: a ref this build DECLARES may be installed
  // lazily; anything else must already be present, and its absence is an error
  // rather than an invitation to install something similar.
  const declared = createModelRef(segmentationPackage());
  try {
    const resolved = await store.resolve({ projectKey: PROJECT, modelRef: wanted });
    return { model: resolved.model, modelRef: resolved.modelRef };
  } catch (error) {
    if (error?.code !== 'GATHER_MODEL_UNAVAILABLE') throw error;
    if (wanted.revision !== declared.revision) throw error;
    const installed = await store.install({
      projectKey: PROJECT,
      modelPackage: segmentationPackage(),
      artifactBytes,
    });
    return { model: installed.model, modelRef: installed.modelRef };
  }
};

/** The catalog + invoker an authored composition actually reaches. */
const makeInvoker = ({ store, defaults, onExecute }) => {
  const functions = capabilityFunctions({
    definitions: CAPABILITY_DEFINITIONS,
    runtime: createCapabilityRuntime({
      resolveModel: makeResolver({ store, defaults }),
      segmentExecute: async ({ image, model }) => {
        onExecute({ image, model });
        // A real engine reads model.artifact/tensor; asserting they arrived is
        // the whole point, so touch them.
        assert.equal(typeof model?.tensor?.inputName, 'string', 'engine got a real package');
        return { mask: { assetId: 'mask-1', path: 'm.png' }, threshold: 0.5 };
      },
      classifyExecute: async () => ({ ranked: [] }),
      measurementAdapter: { maskMeasurements: () => ({}), imageMeasurements: () => ({}) },
    }),
  });
  return new Catalog('gather-test', [], functions);
};

const image = {
  assetId: 'image-1',
  uri: 'file:///i.jpg',
  path: 'i.jpg',
  width: 8,
  height: 8,
  mimeType: 'image/jpeg',
  sha256: `sha256:${'b'.repeat(64)}`,
};

// --- workflow 1 — capability default ------------------------------------

test('WORKFLOW 1: image.segment(image) uses the app default, installs it, and records it', async () => {
  const { store } = makeStore();
  const defaultRef = createModelRef(segmentationPackage());
  const executed = [];
  const catalog = makeInvoker({
    store,
    defaults: { 'image.segment': defaultRef },
    onExecute: (input) => executed.push(input),
  });

  // No modelRef in the authored call at all — this is `image.segment(image)`.
  const result = await catalog.invoker(a2uiFunctionId('image.segment'), { image }, {}, undefined);

  assert.equal(executed.length, 1, 'the engine ran');
  assert.equal(executed[0].model.identity.id, 'test-segmenter', 'and received a resolved package');
  assert.equal(result.model.revision, defaultRef.revision, 'the result carries the concrete ref');
  assert.equal(result.model.taskProfile, 'segmentation.binary.v1');

  // Provenance records the model actually used, not the policy that chose it.
  const receipt = createExecutionReceipt({
    capability: 'image.segment',
    capabilityRevision: '1',
    model: result.model,
    inputs: { image: image.sha256 },
    outputs: { mask: 'sha256:mask' },
    runtime: { onnxruntime: 'test' },
    timestamp: '2026-09-04T00:00:00.000Z',
  });
  assert.equal(receipt.model.revision, defaultRef.revision);
  assert.equal(receipt.model.id, 'test-segmenter');

  // Lazily installed on first use, and now present on the device.
  const installed = await store.listInstalled({ projectKey: PROJECT });
  assert.equal(installed.length, 1);
  assert.equal(installed[0].modelRef.revision, defaultRef.revision);
});

// --- workflow 2 — explicit ModelRef from the Composer --------------------

test('WORKFLOW 2: an authored FunctionCall carrying a ModelRef resolves and executes', async () => {
  const { store } = makeStore();
  const chosen = createModelRef(segmentationPackage());
  const executed = [];
  const catalog = makeInvoker({
    store,
    // A different default, so a passing test cannot be the default in disguise.
    defaults: { 'image.segment': { ...chosen, revision: `sha256:${'c'.repeat(64)}` } },
    onExecute: (input) => executed.push(input),
  });

  const result = await catalog.invoker(
    a2uiFunctionId('image.segment'),
    { image, modelRef: chosen },
    {},
    undefined
  );

  assert.equal(executed.length, 1);
  assert.equal(result.model.revision, chosen.revision, 'the authored ref won, not the default');
  assert.equal(result.mask.assetId, 'mask-1');
});

test('WORKFLOW 2: an incompatible ModelRef is refused before the engine runs', async () => {
  const { store } = makeStore();
  const executed = [];
  const catalog = makeInvoker({
    store,
    defaults: {},
    onExecute: (input) => executed.push(input),
  });

  await assert.rejects(
    () =>
      catalog.invoker(
        a2uiFunctionId('image.segment'),
        {
          image,
          modelRef: {
            id: 'x',
            version: '1',
            revision: `sha256:${'d'.repeat(64)}`,
            taskProfile: 'classification.ranked.v1',
          },
        },
        {},
        undefined
      ),
    /incompatible|does not satisfy|not installed/i
  );
  assert.deepEqual(executed, [], 'nothing executed');
});

test('a model this build does not have is a clear failure, not a silent one', async () => {
  const { store } = makeStore();
  const catalog = makeInvoker({ store, defaults: {}, onExecute: () => {} });
  await assert.rejects(
    () =>
      catalog.invoker(
        a2uiFunctionId('image.segment'),
        {
          image,
          modelRef: {
            id: 'absent',
            version: '1',
            revision: `sha256:${'e'.repeat(64)}`,
            taskProfile: 'segmentation.binary.v1',
          },
        },
        {},
        undefined
      ),
    /not installed|GATHER_MODEL_UNAVAILABLE/i
  );
});

// --- the Composer's side -------------------------------------------------

test('the Model Catalog offers what this build can provide, annotated by what is installed', () => {
  // The distinction that matters: models install lazily, so a catalog built
  // from installed state alone would hide models an author may legitimately
  // choose.
  const offered = buildModelCatalog({ installed: [] });
  assert.equal(offered.length, BUNDLED_MODELS.length, 'nothing installed, everything still offered');
  assert.ok(offered.every((entry) => entry.installed === false));

  const annotated = buildModelCatalog({ installed: [{ modelRef: offered[0].modelRef }] });
  assert.equal(annotated[0].installed, true);
  assert.equal(annotated[1].installed, false);
  assert.equal(annotated.length, offered.length, 'installation changes annotation, not membership');
});

test('the Composer can go from a capability to the models that satisfy it', () => {
  const catalog = buildModelCatalog({});
  const forSegment = modelsForCapability(catalog, capabilityDefinitionsById['image.segment']);
  const forClassify = modelsForCapability(catalog, capabilityDefinitionsById['image.classify']);

  assert.ok(forSegment.length > 0);
  assert.ok(forSegment.every((entry) => entry.taskProfile === 'segmentation.binary.v1'));
  assert.ok(forClassify.every((entry) => entry.taskProfile === 'classification.ranked.v1'));
  assert.deepEqual(
    forSegment.filter((entry) => forClassify.includes(entry)),
    [],
    'the two sets are disjoint for these profiles'
  );

  // A capability that takes no model offers none.
  assert.deepEqual(modelsForCapability(catalog, capabilityDefinitionsById['measure.area']), []);

  // Every entry carries a usable ModelRef — the only model shape allowed to
  // reach an authored composition.
  for (const entry of catalog) {
    assert.equal(typeof entry.modelRef.revision, 'string');
    assert.equal(entry.modelRef.taskProfile, entry.taskProfile);
    assert.equal(entry.source, 'app');
  }
});

test('this build declares a compatible default for every model-backed capability', () => {
  // A default that does not satisfy its own capability is a configuration bug,
  // and the policy refuses it rather than failing later inside the capability.
  for (const definition of CAPABILITY_DEFINITIONS) {
    if (definition.acceptedModelProfiles.length === 0) continue;
    const ref = defaultModelRefFor(definition.id, definition.acceptedModelProfiles);
    assert.ok(ref, `${definition.id} has a default model`);
    assert.ok(
      definition.acceptedModelProfiles.includes(ref.taskProfile),
      `${definition.id}'s default satisfies it`
    );
    assert.ok(bundledModelForRef(ref), `${definition.id}'s default is a model this build ships`);
  }
});

test('an incompatible default is refused at policy level', () => {
  assert.throws(
    () => defaultModelRefFor('image.segment', ['classification.ranked.v1']),
    (error) => {
      assert.equal(error.code, 'GATHER_MODEL_DEFAULT_INCOMPATIBLE');
      return true;
    }
  );
});
