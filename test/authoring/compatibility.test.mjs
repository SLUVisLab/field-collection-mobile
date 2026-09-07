import assert from 'node:assert/strict';
import test from 'node:test';

import { CAPABILITY_DEFINITIONS } from 'gather-capabilities';

import { CHECK_IDS, compatibilityFor } from '../../src/authoring/compatibility.js';
import { previewModels } from '../../apps/renderer/src/preview/previewModels.js';

/**
 * Subjects come from the real Model Catalog and the real Capability
 * definitions. Fixture metadata would drift away from what ships, and this
 * report exists to tell an author what will actually happen.
 */
const definitions = CAPABILITY_DEFINITIONS;
const models = previewModels;
const modelOfProfile = (profile) => models.find((m) => m.taskProfile === profile);
const report = (input) => compatibilityFor({ definitions, models, ...input });
const checkIn = (section, id) => section.checks.find((c) => c.id === id);

test('a valid segmentation model passes for image.segment', () => {
  const model = modelOfProfile('segmentation.binary.v1');
  assert.ok(model, 'the catalog declares no segmentation model');
  const result = report({ capabilityId: 'image.segment', modelRef: model.modelRef });
  assert.equal(result.status, 'pass');
  assert.equal(checkIn(result.structural, CHECK_IDS.packageValid).status, 'pass');
  assert.equal(checkIn(result.capability, CHECK_IDS.profileAccepted).status, 'pass');
  assert.equal(checkIn(result.availability, CHECK_IDS.available).status, 'pass');
});

test('a classification model fails for image.segment', () => {
  const model = modelOfProfile('classification.ranked.v1');
  assert.ok(model, 'the catalog declares no classification model');
  const result = report({ capabilityId: 'image.segment', modelRef: model.modelRef });
  assert.equal(result.status, 'fail');
  assert.equal(result.capability.status, 'fail');
  assert.match(
    checkIn(result.capability, CHECK_IDS.profileAccepted).message,
    /not accepted by image\.segment/
  );
  // Wrong capability, but the package itself is still fine — the sections must
  // not contaminate each other.
  assert.equal(result.structural.status, 'pass');
});

test('a compatible model this distribution does not ship is a WARNING, not a FAIL', () => {
  const model = modelOfProfile('segmentation.binary.v1');
  const elsewhere = {
    ...model.modelRef,
    revision: `sha256:${'a'.repeat(64)}`,
  };
  const result = report({ capabilityId: 'image.segment', modelRef: elsewhere });
  assert.equal(result.availability.status, 'warning');
  assert.equal(result.status, 'warning', 'not shipping a model is a packaging question');
  assert.notEqual(result.status, 'fail');
});

test('an invented revision fails structurally', () => {
  const result = report({
    capabilityId: 'image.segment',
    modelRef: { id: 'x', version: '1.0.0', revision: 'not-a-digest', taskProfile: 'segmentation.binary.v1' },
  });
  assert.equal(result.structural.status, 'fail');
  assert.equal(result.status, 'fail');
});

test('an omitted modelRef reports the default rather than refusing', () => {
  const result = report({ capabilityId: 'image.segment', modelRef: null });
  assert.equal(result.status, 'pass');
  assert.equal(result.subject.modelRef, null);
  assert.match(checkIn(result.capability, CHECK_IDS.profileAccepted).message, /default/i);
});

test('a simulated preview never improves the compatibility verdict', () => {
  const model = modelOfProfile('classification.ranked.v1');
  const withPreview = report({
    capabilityId: 'image.segment',
    modelRef: model.modelRef,
    previewEvidence: { attempted: true, fidelity: 'simulated', backend: 'renderer-preview', status: 'pass' },
  });
  assert.equal(withPreview.status, 'fail', 'a preview must not rescue an incompatible model');
  assert.equal(withPreview.preview.fidelity, 'simulated');
  assert.match(
    checkIn(withPreview.preview, CHECK_IDS.previewExecuted).message,
    /about this renderer and not about the model/
  );
});

test('never having run the Model Lab is not a compatibility failure', () => {
  const model = modelOfProfile('segmentation.binary.v1');
  const result = report({ capabilityId: 'image.segment', modelRef: model.modelRef });
  assert.equal(result.preview.attempted, false);
  assert.equal(checkIn(result.preview, CHECK_IDS.previewExecuted).status, 'warning');
  assert.equal(result.status, 'pass', 'missing future evidence must not read as incompatibility');
});

test('real preview evidence replaces simulated with no schema change', () => {
  const model = modelOfProfile('segmentation.binary.v1');
  const simulated = report({
    capabilityId: 'image.segment',
    modelRef: model.modelRef,
    previewEvidence: { attempted: true, fidelity: 'simulated', backend: 'renderer-preview', status: 'pass' },
  });
  const real = report({
    capabilityId: 'image.segment',
    modelRef: model.modelRef,
    previewEvidence: { attempted: true, fidelity: 'real', backend: 'onnxruntime-web', status: 'pass' },
  });
  // Phase 2 changes only the backend; the subject, sections and verdict hold.
  assert.deepEqual(simulated.subject, real.subject);
  assert.equal(simulated.status, real.status);
  assert.equal(checkIn(simulated.preview, CHECK_IDS.previewExecuted).status, 'warning');
  assert.equal(checkIn(real.preview, CHECK_IDS.previewExecuted).status, 'pass');
  assert.match(checkIn(real.preview, CHECK_IDS.previewExecuted).message, /Native execution remains authoritative/);
});
