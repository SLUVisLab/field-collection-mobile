import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createGatherFunctions } from '../../apps/renderer/src/preview/gatherFunctions.js';
import { ADVERTISED_CAPABILITIES } from '../../apps/renderer/src/preview/previewRuntime.js';
import { previewModels, resolvePreviewModel } from '../../apps/renderer/src/preview/previewModels.js';

/**
 * The Composer can only author what the renderer advertises.
 *
 * Before this, `apps/renderer` passed only upstream's Basic Catalog functions
 * to its `Catalog`, so the handshake returned 27 Components and 25 functions —
 * none of them Gather's. The agent could not author `image_segment` because it
 * did not know the function existed, while the device ran that exact Tool.
 *
 * The expected set is **derived from the canonical Tool**, not restated here.
 * A hand-maintained list is the same failure one level up: it would have passed
 * throughout the period the renderer advertised nothing.
 */

const definition = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json',
        import.meta.url
      )
    ),
    'utf8'
  )
);

const callsInCanonicalTool = definition.messages
  .flatMap((message) => message.updateComponents?.components ?? [])
  .map((component) => component.action?.functionCall?.call)
  .filter(Boolean);

test('the canonical Tool actually calls functions', () => {
  // Guards the derivation: a refactor of the artifact's shape must not quietly
  // reduce this file to asserting nothing.
  assert.ok(callsInCanonicalTool.length >= 4, `found ${callsInCanonicalTool.length} calls`);
  assert.ok(callsInCanonicalTool.includes('image_segment'));
});

test('the renderer advertises every function the canonical Tool calls', () => {
  const advertised = new Set(createGatherFunctions().map((fn) => fn.name));
  const missing = callsInCanonicalTool.filter((call) => !advertised.has(call));
  assert.deepEqual(
    missing,
    [],
    `the Composer could not author: ${missing.join(', ')}. Advertised: ${[...advertised].join(', ')}`
  );
});

test('every advertised capability can actually execute', () => {
  // `capabilityFunctions` only registers a definition that has a runtime entry,
  // so this asserts the advertised set is the executable set.
  const advertised = new Set(createGatherFunctions().map((fn) => fn.name));
  for (const id of ADVERTISED_CAPABILITIES) {
    assert.ok(advertised.has(id.replace(/\./g, '_')), `${id} is declared but not advertised`);
  }
});

test('an advertised function carries an executable implementation', () => {
  for (const fn of createGatherFunctions()) {
    assert.equal(typeof fn.execute, 'function', `${fn.name} has no execute`);
  }
});

test('the model resolver only offers models this distribution declares', async () => {
  assert.ok(previewModels.length > 0, 'the generated Model Catalog projection is empty');

  const resolved = await resolvePreviewModel({
    capabilityId: 'image.segment',
    acceptedModelProfiles: ['segmentation.binary.v1'],
    modelRef: null,
  });
  assert.equal(resolved.modelRef.taskProfile, 'segmentation.binary.v1');

  await assert.rejects(
    () =>
      resolvePreviewModel({
        capabilityId: 'image.segment',
        acceptedModelProfiles: ['segmentation.binary.v1'],
        modelRef: { revision: 'sha256:notamodel' },
      }),
    /revision sha256:notamodel/
  );
});
