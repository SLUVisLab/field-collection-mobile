import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createModelStore } from '../../src/scientific/models/modelStore.js';
import { sha256For } from '../../src/scientific/contracts.js';
import { createScientificModelRef, TASK_PROFILES } from '../../src/scientific/models/modelPackage.js';
import { BUNDLED_MODEL_PACKAGES } from '../../src/scientific/models/bundledModelPackages.js';
import { validateScientificModelPackage } from '../../src/scientific/models/modelPackage.js';
import { ensureModelAvailable } from '../../src/scientific/models/modelAvailability.js';

const artifact = new Uint8Array([9, 8, 7]);
const modelPackage = {
  identity: { id: 'fixture-model', version: '1.0.0' },
  taskProfile: TASK_PROFILES.segmentationBinary,
  artifact: { path: 'bundle/fixture.onnx', sha256: sha256For(artifact) },
  tensor: { inputName: 'input', inputShape: [1, 3, 2, 2], outputNames: ['output'] },
  upstream: { project: 'fixture', revision: 'pinned', license: 'MIT' },
  preprocessing: [{ operation: 'resize', width: 2, height: 2 }],
  postprocessing: [{ operation: 'binaryMask' }],
};

const fakeStore = () => {
  const values = new Map();
  const writes = [];
  return {
    values,
    writes,
    readBytes: async (key) => values.get(key),
    readText: async (key) => values.get(key),
    writeBytesAtomic: async (key, value) => { writes.push(key); values.set(key, value); },
    writeTextAtomic: async (key, value) => { writes.push(key); values.set(key, value); },
    fileExists: async (key) => values.has(key),
    fileForKey: (key) => ({ uri: `file:///documents/gather/${key}` }),
  };
};

test('Model Store installs verified immutable packages and resolves local ONNX paths', async () => {
  const deps = fakeStore();
  const store = createModelStore(deps);
  const installed = await store.install({ projectKey: 'project-a', modelPackage, artifactBytes: artifact });
  assert.equal(installed.model.identity.id, 'fixture-model');
  assert.match(installed.artifactPath, /models\/[a-f0-9]{64}\/model\.onnx$/);
  const writeCount = deps.writes.length;
  const repeated = await store.install({ projectKey: 'project-a', modelPackage, artifactBytes: artifact });
  assert.equal(repeated.modelRef.revision, installed.modelRef.revision);
  assert.equal(deps.writes.length, writeCount);
});

test('Model Store rejects tampered model artifact bytes before installation', async () => {
  const store = createModelStore(fakeStore());
  await assert.rejects(
    store.install({ projectKey: 'project-a', modelPackage, artifactBytes: new Uint8Array([1]) }),
    { code: 'GATHER_MODEL_HASH_MISMATCH' }
  );
});

test('Model Store rejects an installed artifact that no longer verifies', async () => {
  const deps = fakeStore();
  const store = createModelStore(deps);
  const installed = await store.install({ projectKey: 'project-a', modelPackage, artifactBytes: artifact });
  deps.values.set(installed.keys.artifact, new Uint8Array([1]));
  const freshStore = createModelStore(deps);
  await assert.rejects(
    freshStore.resolve({ projectKey: 'project-a', modelRef: installed.modelRef }),
    { code: 'GATHER_MODEL_HASH_MISMATCH' }
  );
});

test('bundled reference packages use supported immutable model profiles', () => {
  for (const modelPackage of Object.values(BUNDLED_MODEL_PACKAGES)) {
    const validated = validateScientificModelPackage(modelPackage);
    assert.equal(validated.identity.id, modelPackage.identity.id);
    assert.match(validated.artifact.sha256, /^sha256:[a-f0-9]{64}$/);
  }
});

test('bundled reference artifact files match their package digests', async () => {
  const assetFiles = {
    u2netp: '../../assets/scientific/models/u2netp.onnx',
    mobilenetV3Large: '../../assets/scientific/models/mobilenet-v3-large-imagenet1k-v2.onnx',
  };
  for (const [name, path] of Object.entries(assetFiles)) {
    const bytes = new Uint8Array(await readFile(new URL(path, import.meta.url)));
    assert.equal(sha256For(bytes), BUNDLED_MODEL_PACKAGES[name].artifact.sha256);
  }
  const labels = new Uint8Array(await readFile(new URL('../../assets/scientific/models/imagenet-1k-labels.txt', import.meta.url)));
  assert.equal(sha256For(labels), BUNDLED_MODEL_PACKAGES.mobilenetV3Large.labels.sha256);
});

test('bundled model lookup does not reinstall an already verified revision', async () => {
  const modelPackage = BUNDLED_MODEL_PACKAGES.u2netp;
  const modelRef = createScientificModelRef(modelPackage);
  let installs = 0;
  const resolved = await ensureModelAvailable({
    projectKey: 'project-a',
    modelPackage,
    install: async () => { installs += 1; },
    modelStore: {
      resolve: async ({ modelRef: received }) => ({ modelRef: received, artifactPath: 'file:///model.onnx' }),
    },
  });
  assert.equal(installs, 0);
  assert.equal(resolved.modelRef.revision, modelRef.revision);
});
