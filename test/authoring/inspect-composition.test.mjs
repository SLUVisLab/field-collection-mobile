import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CAPABILITY_DEFINITIONS } from 'gather-capabilities';

import { inspectComposition } from '../../src/authoring/inspectComposition.js';
import { previewModels } from '../../apps/renderer/src/preview/previewModels.js';

/**
 * Subjects are the artifacts that ship: the canonical Segment & Measure Tool
 * and the real Capability definitions. Expectations are derived from those,
 * never restated, so a Tool or a Capability changing shows up here rather than
 * in a wrapper panel showing something wrong.
 */
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

test('the projection agrees with the real Capability definitions', () => {
  // Guards the data the analyzer consumes: a drifted projection would make
  // every assertion below meaningless.
  assert.equal(capabilities.length, CAPABILITY_DEFINITIONS.length);
  for (const definition of CAPABILITY_DEFINITIONS) {
    const projected = capabilities.find((entry) => entry.id === definition.id);
    assert.ok(projected, `${definition.id} is missing from capabilities.json`);
    assert.deepEqual(projected.acceptedModelProfiles, definition.acceptedModelProfiles ?? []);
    assert.equal(projected.takesModelRef, Boolean(definition.input?._def?.shape?.().modelRef));
  }
});

test('the canonical Tool is understood end to end', () => {
  const result = analyze(CANONICAL.messages);
  assert.deepEqual(
    result.calls.map((call) => call.functionName),
    ['gather_persistAsset', 'image_segment', 'measure_area', 'gather_completeComposition']
  );
  assert.deepEqual(result.capabilities.sort(), ['image.segment', 'measure.area']);
  assert.deepEqual(result.issues, []);
});

test('its declared outputs come from the document, not a manifest', () => {
  const result = analyze(CANONICAL.messages);
  const declared = CANONICAL.result.outputs.map((output) => output.path).sort();
  assert.deepEqual(result.outputs.sort(), declared);
});

test('the explicit ModelRef is reported as a pin, with its exact revision', () => {
  const result = analyze(CANONICAL.messages);
  assert.equal(result.modelCalls.length, 1, 'only image.segment takes a model here');
  const [segment] = result.modelCalls;
  assert.equal(segment.capabilityId, 'image.segment');
  // The canonical Tool binds its ModelRef through the data model, which is a
  // third state: neither "default" nor a literal pin the wrapper can rewrite.
  assert.equal(segment.model.mode, 'bound');
  assert.equal(segment.model.binding, '/working/modelRef');
  assert.deepEqual(segment.acceptedModelProfiles, ['segmentation.binary.v1']);
  assert.deepEqual(
    segment.compatibleModels.map((model) => model.taskProfile),
    ['segmentation.binary.v1']
  );
});

test('an omitted modelRef is default, with no sentinel to look for', () => {
  const document = [
    {
      version: 'v0.9',
      updateComponents: {
        components: [
          { id: 'a', action: { functionCall: { call: 'image_segment', args: { image: {} } } } },
          { id: 'b', action: { functionCall: { call: 'gather_completeComposition', args: { outputs: { x: {} } } } } },
        ],
      },
    },
  ];
  const [segment] = analyze(document).modelCalls;
  assert.equal(segment.model.mode, 'default');
  assert.equal(segment.model.modelRef, null);
});

test('two calls to the same capability stay separately addressable', () => {
  const call = (id) => ({ id, action: { functionCall: { call: 'image_segment', args: { image: {} } } } });
  const document = [
    { version: 'v0.9', updateComponents: { components: [call('first'), call('second')] } },
  ];
  const { modelCalls } = analyze(document);
  assert.equal(modelCalls.length, 2);
  assert.notEqual(modelCalls[0].occurrenceId, modelCalls[1].occurrenceId);
  // Addressed by position in the document, so nothing is minted inside the
  // artifact to support the wrapper.
  assert.deepEqual(modelCalls[0].documentPath, [0, 'updateComponents', 'components', 0]);
});

test('a pinned model this distribution does not accept is an issue, not a crash', () => {
  const document = [
    {
      version: 'v0.9',
      updateComponents: {
        components: [
          {
            id: 'a',
            action: {
              functionCall: {
                call: 'image_segment',
                args: { image: {}, modelRef: { id: 'x', revision: `sha256:${'b'.repeat(64)}` } },
              },
            },
          },
        ],
      },
    },
  ];
  const { issues, modelCalls } = analyze(document);
  assert.equal(modelCalls[0].model.mode, 'explicit');
  assert.ok(issues.some((issue) => issue.code === 'GATHER_TOOL_MODEL_NOT_COMPATIBLE'));
});

test('an empty Tool says so rather than analyzing to nothing', () => {
  const { issues } = analyze([]);
  assert.deepEqual(
    issues.map((issue) => issue.code).sort(),
    ['GATHER_TOOL_NO_CALLS', 'GATHER_TOOL_NO_OUTPUTS']
  );
});
