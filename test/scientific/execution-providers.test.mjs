import test from 'node:test';
import assert from 'node:assert/strict';

import { executionProvidersFor } from '../../src/scientific/runtime/executionProviders.js';

test('native ONNX sessions prefer available platform accelerators with CPU fallback', () => {
  assert.deepEqual(executionProvidersFor('android'), ['nnapi', 'xnnpack', 'cpu']);
  assert.deepEqual(executionProvidersFor('ios'), ['coreml', 'xnnpack', 'cpu']);
  assert.deepEqual(executionProvidersFor('web'), ['cpu']);
});
