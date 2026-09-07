import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { inspectComposition } from '../../src/authoring/inspectComposition.js';
import { previewEvidenceKey, previewSubjectFor } from '../../src/authoring/previewEvidence.js';
import { previewModels } from '../../apps/renderer/src/preview/previewModels.js';

const read = (relative) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));
const CANONICAL = read(
  '../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json'
);
const capabilities = read('../../apps/renderer/public/capabilities.json').capabilities;
/**
 * These tests exercise message analysis, so they hand in message lists and this
 * wraps each in the smallest composition that is one. Explicit on purpose: the
 * production API refuses a bare list, and a test helper that hid that would be
 * testing a shape no caller can pass.
 */
const asComposition = (messages) =>
  Array.isArray(messages)
    ? { id: 'test.tool', catalogId: 'test', surfaceId: 'test', messages }
    : messages;

const analyze = (messages) =>
  inspectComposition({ composition: asComposition(messages), capabilities, models: previewModels });
const backend = { id: 'onnxruntime-web', version: '1.23.0' };
const segmentation = previewModels.find((m) => m.taskProfile === 'segmentation.binary.v1');

test('the key separates every dimension that can change a result', () => {
  const base = { capabilityId: 'image.segment', modelRef: segmentation.modelRef, sampleDigest: 'sha256:aa', backend };
  const key = previewEvidenceKey(base);
  assert.notEqual(key, previewEvidenceKey({ ...base, sampleDigest: 'sha256:bb' }));
  assert.notEqual(key, previewEvidenceKey({ ...base, capabilityId: 'image.classify' }));
  // A backend upgrade can change what a model does, so evidence must not carry over.
  assert.notEqual(key, previewEvidenceKey({ ...base, backend: { ...backend, version: '1.24.0' } }));
  assert.equal(key, previewEvidenceKey({ ...base }));
});

test('an incomplete key is refused rather than silently weak', () => {
  assert.throws(
    () => previewEvidenceKey({ capabilityId: 'image.segment', modelRef: segmentation.modelRef, sampleDigest: 'sha256:aa' }),
    /backend\.id, backend\.version/
  );
});

test('a default selection is previewable, and names the model it ran', () => {
  const document = [
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
  const analysis = analyze(document);
  const [call] = analysis.modelCalls;
  assert.equal(call.model.mode, 'default');
  assert.equal(call.dependency.certainty, 'unresolved');

  const subject = previewSubjectFor({ call, models: previewModels });
  assert.equal(subject.runnable, true);
  assert.equal(subject.resolvedFrom, 'default');
  assert.equal(subject.modelRef.revision, segmentation.modelRef.revision);

  // Previewing must not make the Tool explicit, nor freeze its dependency.
  const after = analyze(document);
  assert.equal(after.modelCalls[0].model.mode, 'default');
  assert.equal(after.modelCalls[0].dependency.certainty, 'unresolved');
});

test('the canonical Tool previews the model behind its binding', () => {
  const [call] = analyze(CANONICAL.messages).modelCalls;
  const subject = previewSubjectFor({ call, models: previewModels });
  assert.equal(subject.resolvedFrom, 'binding');
  assert.equal(subject.modelRef.revision, segmentation.modelRef.revision);
});

test('a dynamic binding has no single subject to preview', () => {
  const document = [
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
  ];
  const [call] = analyze(document).modelCalls;
  const subject = previewSubjectFor({ call, models: previewModels });
  assert.equal(subject.runnable, false);
  assert.match(subject.reason, /run time|Tool state/);
});
