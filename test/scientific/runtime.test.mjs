import test from 'node:test';
import assert from 'node:assert/strict';

import { createImageAssetService } from '../../src/scientific/assets/imageAssetService.js';
import { createOnnxRuntime } from '../../src/scientific/runtime/onnxRuntime.js';

const digest = `sha256:${'b'.repeat(64)}`;
const model = {
  identity: { id: 'test-model' },
  artifact: { path: '/models/test.onnx', sha256: digest },
};

test('image asset service persists immutable bytes and returns only serializable metadata', async () => {
  const writes = [];
  const service = createImageAssetService({
    readCaptureBytes: async (path) => {
      assert.equal(path, '/cache/camera.jpg');
      return new Uint8Array([1, 2, 3]);
    },
    writeBytesAtomic: async (key, bytes) => writes.push({ key, bytes: [...bytes] }),
    fileUriForKey: (key) => `file:///documents/${key}`,
    newAssetId: () => 'image-1',
  });
  const asset = await service.persistCapture({
    capture: { path: '/cache/camera.jpg', contentType: 'image/jpeg', width: 2, height: 3 },
    fileKey: '/documents/scientific/image-1.jpg',
    capturedAt: '2026-08-29T00:00:00.000Z',
  });
  assert.deepEqual(writes, [{ key: '/documents/scientific/image-1.jpg', bytes: [1, 2, 3] }]);
  assert.equal(asset.path, '/documents/scientific/image-1.jpg');
  assert.equal(asset.sha256, 'sha256:039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81');
});

test('image asset service surfaces a native temporary capture read failure', async () => {
  const service = createImageAssetService({
    readCaptureBytes: async () => {
      throw new Error('File does not exist');
    },
    writeBytesAtomic: async () => {},
    fileUriForKey: () => 'file:///documents/image-1.jpg',
    newAssetId: () => 'image-1',
  });
  await assert.rejects(
    () => service.persistCapture({
      capture: { path: '/cache/missing.jpg', contentType: 'image/jpeg', width: 2, height: 3 },
      fileKey: 'projects/test/media/image-1.jpg',
    }),
    /The captured image could not be read\. File does not exist/
  );
});

test('ONNX adapter reuses bounded sessions and returns no tensor objects', async () => {
  const created = [];
  const runtime = createOnnxRuntime({
    createSession: async (path) => {
      created.push(path);
      return { run: async () => ({ mask: { dims: [1, 1, 2], data: new Float32Array([0, 1]) } }) };
    },
    createTensor: (type, data, dims) => ({ type, data, dims }),
  });

  const input = { model, inputName: 'input', inputData: new Float32Array([1, 2]), inputDimensions: [1, 2], outputNames: ['mask'] };
  assert.deepEqual(await runtime.run(input), { mask: { dimensions: [1, 1, 2], data: [0, 1] } });
  await runtime.run(input);
  assert.deepEqual(created, ['/models/test.onnx']);
});

test('ONNX runtime reports session creation then cache reuse timing', async () => {
  const timing = [];
  const runtime = createOnnxRuntime({
    createSession: async () => ({ run: async () => ({ output: { dims: [1], data: new Float32Array([1]) } }) }),
    createTensor: () => ({}),
  });
  const timedModel = { identity: { id: 'timed' }, artifact: { sha256: 'sha256:timed', path: 'model.onnx' } };
  const input = { model: timedModel, inputName: 'input', inputData: new Float32Array([1]), inputDimensions: [1], outputNames: ['output'] };
  await runtime.run({ ...input, onTiming: (entry) => timing.push(entry) });
  await runtime.run({ ...input, onTiming: (entry) => timing.push(entry) });
  assert.equal(timing.find((entry) => entry.phase === 'sessionCreate').cacheHit, false);
  assert.equal(timing.find((entry) => entry.phase === 'sessionCacheLookup').cacheHit, true);
});
