import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ModelError,
  TASK_PROFILES,
  createModelRef,
  createModelStore,
  modelRevisionFor,
  validateModelPackage,
} from '../src/index.js';

// The package's own surface, with nothing app-specific: no bundled catalogue,
// no real .onnx bytes, no filesystem. Verifying the app's shipped models
// against their descriptors is an app test and stays app-side.

const digest = (char) => `sha256:${char.repeat(64)}`;

const modelPackage = () => ({
  identity: { id: 'u2netp', version: '1.0.0' },
  taskProfile: TASK_PROFILES.segmentationBinary,
  artifact: { path: 'models/u2netp.onnx', sha256: digest('a') },
  tensor: { inputName: 'input', inputShape: [1, 3, 320, 320], outputNames: ['output'] },
  upstream: { project: 'U-2-Net', revision: 'pinned', license: 'Apache-2.0' },
  preprocessing: [{ operation: 'resize', width: 320, height: 320 }],
  postprocessing: [{ operation: 'sigmoid' }, { operation: 'threshold', value: 0.5 }, { operation: 'binaryMask' }],
});

test('a model package validates against a constrained set of task profiles', () => {
  assert.deepEqual(validateModelPackage(modelPackage()), modelPackage());
  assert.throws(
    () => validateModelPackage({ ...modelPackage(), taskProfile: 'anything.execute.v1' }),
    ModelError
  );
  assert.throws(() => validateModelPackage({ ...modelPackage(), artifact: { path: 'x' } }), ModelError);
});

test('a model reference is content-addressed, so identity plus bytes fix the revision', () => {
  const reference = createModelRef(modelPackage());
  assert.equal(reference.id, 'u2netp');
  assert.equal(reference.version, '1.0.0');
  assert.match(reference.revision, /^sha256:[a-f0-9]{64}$/);

  // Same descriptor, same revision — the property the store's verification and
  // a receipt's provenance both rely on.
  assert.equal(modelRevisionFor(modelPackage()), reference.revision);
  // Different artifact bytes, different revision.
  const other = { ...modelPackage(), artifact: { path: 'models/u2netp.onnx', sha256: digest('b') } };
  assert.notEqual(modelRevisionFor(other), reference.revision);
});

test('the store refuses to be built without its injected filesystem', () => {
  // No Expo, no React Native, no native objects reach this package: the app
  // supplies the adapter, which is what keeps the subsystem portable.
  assert.throws(() => createModelStore({}), ModelError);
});
