import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { inspectComposition } from '../../src/authoring/inspectComposition.js';
import { ModelSelectionError, setModelSelection } from '../../src/authoring/setModelSelection.js';
import { previewModels } from '../../apps/renderer/src/preview/previewModels.js';

const read = (relative) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));

/**
 * The canonical M10 artifact is the regression subject on purpose: it is the
 * Tool that ran on hardware, and it is bound rather than literal. Keeping it
 * unchanged is what stops us forgetting that bound calls exist.
 */
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
const segmentation = previewModels.find((m) => m.taskProfile === 'segmentation.binary.v1');
const classification = previewModels.find((m) => m.taskProfile === 'classification.ranked.v1');

const another = {
  ...segmentation.modelRef,
  id: 'another-segmenter',
  revision: `sha256:${'c'.repeat(64)}`,
  taskProfile: 'segmentation.binary.v1',
};

test('changing a bound model rewrites the value and keeps the binding', () => {
  const analysis = analyze(CANONICAL.messages);
  const [call] = analysis.modelCalls;
  const { document, form } = setModelSelection({
    document: CANONICAL.messages,
    analysis,
    occurrenceId: call.occurrenceId,
    modelRef: another,
    models: [...previewModels, { modelRef: another, taskProfile: 'segmentation.binary.v1' }],
  });
  assert.equal(form, 'binding');

  // The binding survives verbatim — the Tool still selects indirectly.
  const args = document[1].updateComponents.components.find((c) => c.id === 'segmentButton')
    .action.functionCall.args;
  assert.deepEqual(args.modelRef, { path: '/working/modelRef' });

  // And the value behind it changed.
  assert.equal(document[2].updateDataModel.value.modelRef.revision, another.revision);

  // Re-analysis still calls it bound, still resolves it statically.
  const after = analyze(document);
  assert.equal(after.modelCalls[0].model.mode, 'bound');
  assert.equal(after.modelCalls[0].model.resolution.kind, 'static');
  assert.equal(after.modelCalls[0].dependency.modelRef.revision, another.revision);
});

test('unrelated document content is untouched', () => {
  const analysis = analyze(CANONICAL.messages);
  const { document } = setModelSelection({
    document: CANONICAL.messages,
    analysis,
    occurrenceId: analysis.modelCalls[0].occurrenceId,
    modelRef: another,
    models: [{ modelRef: another, taskProfile: 'segmentation.binary.v1' }],
  });
  assert.deepEqual(document[0], CANONICAL.messages[0]);
  assert.deepEqual(document[1], CANONICAL.messages[1]);
  const before = { ...CANONICAL.messages[2].updateDataModel.value };
  const after = { ...document[2].updateDataModel.value };
  delete before.modelRef;
  delete after.modelRef;
  assert.deepEqual(after, before, 'only modelRef should have changed in the data model');
});

test('the source document is never mutated', () => {
  const snapshot = JSON.stringify(CANONICAL.messages);
  const analysis = analyze(CANONICAL.messages);
  setModelSelection({
    document: CANONICAL.messages,
    analysis,
    occurrenceId: analysis.modelCalls[0].occurrenceId,
    modelRef: another,
    models: [{ modelRef: another, taskProfile: 'segmentation.binary.v1' }],
  });
  assert.equal(JSON.stringify(CANONICAL.messages), snapshot);
});

// --- literal and default forms ---------------------------------------------
const literalTool = (args) => [
  {
    version: 'v0.9',
    updateComponents: {
      components: [
        { id: 'seg', action: { functionCall: { call: 'image_segment', args } } },
        { id: 'done', action: { functionCall: { call: 'gather_completeComposition', args: { outputs: { a: {} } } } } },
      ],
    },
  },
];

test('a literal pin can be replaced, and removed back to the default', () => {
  const withPin = literalTool({ image: {}, modelRef: segmentation.modelRef });
  let analysis = analyze(withPin);
  assert.equal(analysis.modelCalls[0].model.mode, 'explicit');

  const cleared = setModelSelection({
    document: withPin,
    analysis,
    occurrenceId: analysis.modelCalls[0].occurrenceId,
    modelRef: null,
  });
  assert.equal(cleared.form, 'literal');
  const args = cleared.document[0].updateComponents.components[0].action.functionCall.args;
  assert.ok(!('modelRef' in args), 'absence is the default; nothing stands in for it');
  assert.equal(analyze(cleared.document).modelCalls[0].model.mode, 'default');
  assert.equal(analyze(cleared.document).modelCalls[0].dependency.certainty, 'unresolved');
});

test('an incompatible model is refused before anything is written', () => {
  const withPin = literalTool({ image: {}, modelRef: segmentation.modelRef });
  const analysis = analyze(withPin);
  assert.throws(
    () =>
      setModelSelection({
        document: withPin,
        analysis,
        occurrenceId: analysis.modelCalls[0].occurrenceId,
        modelRef: classification.modelRef,
        models: previewModels,
      }),
    (error) => error instanceof ModelSelectionError && error.code === 'GATHER_SELECTION_INCOMPATIBLE'
  );
});

test('a dynamic binding is refused rather than guessed at', () => {
  // An action writes the bound path at run time, so no authored value is final.
  const dynamic = [
    {
      version: 'v0.9',
      updateComponents: {
        components: [
          { id: 'pick', action: { functionCall: { call: 'gather_persistAsset', args: { capture: {} } }, resultPath: '/working/modelRef' } },
          { id: 'seg', action: { functionCall: { call: 'image_segment', args: { image: {}, modelRef: { path: '/working/modelRef' } } } } },
          { id: 'done', action: { functionCall: { call: 'gather_completeComposition', args: { outputs: { a: {} } } } } },
        ],
      },
    },
    { version: 'v0.9', updateDataModel: { path: '/working', value: { modelRef: segmentation.modelRef } } },
  ];
  const analysis = analyze(dynamic);
  const call = analysis.modelCalls[0];
  assert.equal(call.model.resolution.kind, 'dynamic');
  assert.equal(call.dependency.certainty, 'indeterminate');
  assert.throws(
    () =>
      setModelSelection({
        document: dynamic,
        analysis,
        occurrenceId: call.occurrenceId,
        modelRef: another,
        models: [{ modelRef: another, taskProfile: 'segmentation.binary.v1' }],
      }),
    (error) => error.code === 'GATHER_SELECTION_BINDING_NOT_STATIC'
  );
});

test('a bound call cannot be silently reduced to the default', () => {
  const analysis = analyze(CANONICAL.messages);
  assert.throws(
    () =>
      setModelSelection({
        document: CANONICAL.messages,
        analysis,
        occurrenceId: analysis.modelCalls[0].occurrenceId,
        modelRef: null,
      }),
    (error) => error.code === 'GATHER_SELECTION_BINDING_NOT_REMOVABLE'
  );
});

// --- shared bindings --------------------------------------------------------
const sharedTool = () => [
  {
    version: 'v0.9',
    updateComponents: {
      components: [
        { id: 'first', action: { functionCall: { call: 'image_segment', args: { image: {}, modelRef: { path: '/working/modelRef' } } } } },
        { id: 'second', action: { functionCall: { call: 'image_segment', args: { image: {}, modelRef: { path: '/working/modelRef' } } } } },
        { id: 'done', action: { functionCall: { call: 'gather_completeComposition', args: { outputs: { a: {} } } } } },
      ],
    },
  },
  { version: 'v0.9', updateDataModel: { path: '/working', value: { modelRef: segmentation.modelRef } } },
];

test('two calls on one binding are reported as sharing it', () => {
  const { modelCalls } = analyze(sharedTool());
  assert.equal(modelCalls.length, 2);
  assert.deepEqual(modelCalls[0].model.sharedWith, [modelCalls[1].occurrenceId]);
  assert.deepEqual(modelCalls[1].model.sharedWith, [modelCalls[0].occurrenceId]);
});

test('the canonical Tool shares nothing, because it has one bound call', () => {
  const { modelCalls } = analyze(CANONICAL.messages);
  assert.deepEqual(modelCalls[0].model.sharedWith, []);
});

test('changing a shared binding is refused until it is acknowledged', () => {
  const document = sharedTool();
  const analysis = analyze(document);
  const models = [{ modelRef: another, taskProfile: 'segmentation.binary.v1' }];
  const attempt = () =>
    setModelSelection({ document, analysis, occurrenceId: analysis.modelCalls[0].occurrenceId, modelRef: another, models });

  // Refused, and it names every call the change would have moved — so a UI can
  // say what is about to happen rather than discovering it afterwards.
  assert.throws(attempt, (error) => {
    assert.equal(error.code, 'GATHER_SELECTION_BINDING_SHARED');
    assert.deepEqual(error.affectedOccurrences.sort(), analysis.modelCalls.map((c) => c.occurrenceId).sort());
    return true;
  });

  const result = setModelSelection({
    document, analysis, occurrenceId: analysis.modelCalls[0].occurrenceId,
    modelRef: another, models, acknowledgeShared: true,
  });
  assert.deepEqual(result.affectedOccurrences.sort(), analysis.modelCalls.map((c) => c.occurrenceId).sort());
  // Both calls now see the new model, which is what the document always meant.
  const after = analyze(result.document);
  for (const call of after.modelCalls) {
    assert.equal(call.model.resolution.modelRef.revision, another.revision);
  }
});

test('a literal change reports moving exactly one call', () => {
  const withPin = literalTool({ image: {}, modelRef: segmentation.modelRef });
  const analysis = analyze(withPin);
  const result = setModelSelection({
    document: withPin, analysis, occurrenceId: analysis.modelCalls[0].occurrenceId,
    modelRef: another, models: [{ modelRef: another, taskProfile: 'segmentation.binary.v1' }],
  });
  assert.deepEqual(result.affectedOccurrences, [analysis.modelCalls[0].occurrenceId]);
});

test('an unrelated binding is untouched by a shared change', () => {
  const document = [
    {
      version: 'v0.9',
      updateComponents: {
        components: [
          { id: 'a', action: { functionCall: { call: 'image_segment', args: { image: {}, modelRef: { path: '/working/segModel' } } } } },
          { id: 'b', action: { functionCall: { call: 'image_segment', args: { image: {}, modelRef: { path: '/working/segModel' } } } } },
          { id: 'c', action: { functionCall: { call: 'image_classify', args: { image: {}, modelRef: { path: '/working/clsModel' } } } } },
          { id: 'done', action: { functionCall: { call: 'gather_completeComposition', args: { outputs: { a: {} } } } } },
        ],
      },
    },
    {
      version: 'v0.9',
      updateDataModel: {
        path: '/working',
        value: { segModel: segmentation.modelRef, clsModel: classification.modelRef },
      },
    },
  ];
  const analysis = analyze(document);
  const segCall = analysis.modelCalls.find((call) => call.capabilityId === 'image.segment');
  assert.equal(segCall.model.selectionGroup.occurrenceIds.length, 2);

  const { document: next, affectedOccurrences } = setModelSelection({
    document, analysis, occurrenceId: segCall.occurrenceId, modelRef: another,
    models: [{ modelRef: another, taskProfile: 'segmentation.binary.v1' }],
    acknowledgeShared: true,
  });
  assert.equal(affectedOccurrences.length, 2, 'only the two segmentation calls');

  const after = analyze(next);
  // The classifier's binding and its value are both exactly as authored.
  const cls = after.modelCalls.find((call) => call.capabilityId === 'image.classify');
  assert.equal(cls.model.resolution.modelRef.revision, classification.modelRef.revision);
  assert.equal(next[0].updateComponents.components[2].action.functionCall.args.modelRef.path, '/working/clsModel');
  assert.deepEqual(next[1].updateDataModel.value.clsModel, classification.modelRef);
});
