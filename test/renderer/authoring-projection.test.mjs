import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CAPABILITY_DEFINITIONS } from 'gather-capabilities';

import {
  authoringInputSchemaFor,
  compatibleModelsFor,
} from '../../apps/renderer/src/preview/authoringSchema.js';
import { previewModels } from '../../apps/renderer/src/preview/previewModels.js';
import { createGatherFunctions } from '../../apps/renderer/src/preview/gatherFunctions.js';

/**
 * The authoring projection must agree with the Model Catalog, and nothing here
 * may restate a model id — a hand-written expectation would keep passing while
 * the projection drifted, which is the failure this file exists to catch.
 */

const definitionFor = (id) => CAPABILITY_DEFINITIONS.find((d) => d.id === id);
const jsonSchemaOf = (name) => {
  const fn = createGatherFunctions().find((f) => f.name === name);
  assert.ok(fn, `${name} is not advertised`);
  // The A2UI catalog serializes `schema`; read the same object it will.
  return fn.schema;
};
const modelRefShape = (schema) => {
  const shape = schema._def.shape();
  const declared = shape.modelRef;
  return declared?._def?.innerType ?? declared;
};

test('a model-backed capability offers exactly the catalog models it accepts', () => {
  for (const capabilityId of ['image.segment', 'image.classify']) {
    const definition = definitionFor(capabilityId);
    const compatible = compatibleModelsFor({ definition, models: previewModels });

    // Derived both ways from the catalog, so this cannot pass by coincidence.
    const expected = previewModels
      .filter((m) => definition.acceptedModelProfiles.includes(m.taskProfile))
      .map((m) => m.modelRef.revision)
      .sort();
    assert.ok(expected.length > 0, `no catalog model is accepted by ${capabilityId}`);

    const schema = authoringInputSchemaFor({ definition, models: previewModels });
    const revisions = [...modelRefShape(schema)._def.shape().revision._def.values].sort();
    assert.deepEqual(revisions, expected, `${capabilityId} advertises the wrong revisions`);
    assert.deepEqual(revisions, compatible.map((m) => m.modelRef.revision).sort());
  }
});

test('no model incompatible with a capability is offered for it', () => {
  const segment = definitionFor('image.segment');
  const offered = compatibleModelsFor({ definition: segment, models: previewModels });
  for (const model of offered) {
    assert.ok(
      segment.acceptedModelProfiles.includes(model.taskProfile),
      `${model.modelRef.id} (${model.taskProfile}) is not accepted by image.segment`
    );
  }
  // And a model of another profile really is excluded, so the filter is doing work.
  const otherProfile = previewModels.find(
    (m) => !segment.acceptedModelProfiles.includes(m.taskProfile)
  );
  if (otherProfile) {
    assert.ok(!offered.some((m) => m.modelRef.revision === otherProfile.modelRef.revision));
  }
});

test('the advertised revision is the catalog revision, verbatim', () => {
  const schema = jsonSchemaOf('image_segment');
  const advertised = [...modelRefShape(schema)._def.shape().revision._def.values];
  for (const revision of advertised) {
    const model = previewModels.find((m) => m.modelRef.revision === revision);
    assert.ok(model, `advertised revision ${revision} is in no catalog entry`);
    assert.match(revision, /^sha256:[a-f0-9]{64}$/);
  }
});

test('omission is the default — there is no sentinel ModelRef', () => {
  const schema = jsonSchemaOf('image_segment');
  assert.equal(schema._def.shape().modelRef.isOptional(), true, 'modelRef must stay optional');
  const revisions = [...modelRefShape(schema)._def.shape().revision._def.values];
  for (const sentinel of ['default', 'gather:default', '']) {
    assert.ok(!revisions.includes(sentinel), `"${sentinel}" is being used as a sentinel revision`);
  }
  // Default selection is product policy, expressed by absence, and the schema
  // must say so in words the agent reads.
  const description = modelRefShape(schema).description ?? '';
  assert.match(description, /Omit to use/i);
});

test('the canonical capability schema is untouched by authoring concerns', () => {
  const canonical = definitionFor('image.segment').input;
  const canonicalRevision = canonical._def.shape().modelRef._def.innerType._def.shape().revision;
  assert.equal(
    canonicalRevision._def.typeName,
    'ZodString',
    'gather-capabilities has acquired an application-specific model enumeration'
  );
});

test('a capability with no compatible model is passed through unchanged', () => {
  const area = definitionFor('measure.area');
  assert.equal(authoringInputSchemaFor({ definition: area, models: previewModels }), area.input);
});

/** The projection is for the web; app-only handles must not reach it. */
test('models.json carries portable authoring metadata only', () => {
  const raw = readFileSync(
    fileURLToPath(new URL('../../apps/renderer/public/models.json', import.meta.url)),
    'utf8'
  );
  const allowed = new Set([
    'modelRef', 'displayName', 'taskProfile', 'upstream',
    'tensor', 'requiresLabels', 'source', 'defaultFor', 'structural',
  ]);
  const { models } = JSON.parse(raw);
  assert.ok(models.length > 0);
  for (const model of models) {
    const extra = Object.keys(model).filter((key) => !allowed.has(key));
    assert.deepEqual(extra, [], `${model.modelRef.id} leaks non-portable fields: ${extra.join(', ')}`);
  }
  // Metro handles, absolute paths and repo-relative reaches are all app-only.
  assert.doesNotMatch(raw, /require\(|\.\.\//, 'models.json leaks a module handle or path');
  assert.doesNotMatch(raw, /\/Users\/|assets\/models\//, 'models.json leaks a filesystem path');
});

/** Fidelity describes this renderer's backend, never the Capability. */
test('simulated is a property of the preview backend, not of image.segment', () => {
  const capabilitySource = readFileSync(
    fileURLToPath(new URL('../../packages/gather-capabilities/src/definitions.js', import.meta.url)),
    'utf8'
  );
  for (const word of ['simulated', 'fidelity', 'preview']) {
    assert.doesNotMatch(
      capabilitySource,
      new RegExp(word, 'i'),
      `gather-capabilities mentions "${word}" — fidelity belongs to a host implementation, ` +
        'and Phase 2 swaps this renderer to ORT-Web without changing the Capability'
    );
  }
});
