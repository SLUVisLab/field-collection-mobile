/**
 * The authoring examples, checked against the contracts they teach.
 *
 * A copyable example is a promise that this is how you call the thing. The
 * failure mode is not that it looks wrong — it is that it stays plausible while
 * the contract moves, and an author copies something the runtime will refuse.
 *
 * So the examples are generated from the definitions plus a metadata layer that
 * carries only what a signature cannot say, and these tests hold the two
 * together: every declared capability has an example, every example names a
 * declared capability, and every example's arguments are exactly the arguments
 * the definition requires.
 *
 * Whether the generated examples actually *run* is the other half, and needs a
 * real runtime — see test/integration/usage-examples.test.mjs in the app.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

/** Node's `assert.throws` does not hand back the error, and these inspect it. */
const refusalFrom = (run) => {
  try {
    run();
  } catch (error) {
    return error;
  }
  return null;
};

import {
  AuthoringMetadataError,
  CAPABILITY_AUTHORING_METADATA,
  CAPABILITY_DEFINITIONS,
  HOST_FUNCTION_METADATA,
  assertAuthoringMetadataMatches,
  functionNameFor,
  usageExampleFor,
} from '../src/index.js';

/** The argument names a definition declares, and which of them are optional. */
const declaredArgs = (definition) => {
  const shape = definition.input?.shape ?? definition.input?._def?.shape?.();
  const entries = Object.entries(shape ?? {});
  return {
    all: entries.map(([name]) => name),
    required: entries.filter(([, schema]) => !schema.isOptional?.()).map(([name]) => name),
    optional: entries.filter(([, schema]) => schema.isOptional?.()).map(([name]) => name),
  };
};

test('every declared capability has an authoring example, and nothing else does', () => {
  const declared = assertAuthoringMetadataMatches();
  assert.deepEqual(declared.sort(), Object.keys(CAPABILITY_AUTHORING_METADATA).sort());
});

test('a capability with no example is a failure, not a silent gap', () => {
  const { image_segment: _dropped, ...incomplete } = CAPABILITY_AUTHORING_METADATA;

  const error = refusalFrom(() => assertAuthoringMetadataMatches({ metadata: incomplete }));

  assert.ok(error instanceof AuthoringMetadataError, 'a missing example was accepted');
  assert.deepEqual(error.missing, ['image_segment']);
});

test('an example for something nobody declares is a failure too', () => {
  const invented = { ...CAPABILITY_AUTHORING_METADATA, measure_vibes: { args: {} } };

  const error = refusalFrom(() => assertAuthoringMetadataMatches({ metadata: invented }));

  assert.ok(error instanceof AuthoringMetadataError, 'an invented example was accepted');
  assert.deepEqual(error.unknown, ['measure_vibes']);
  assert.match(error.message, /not a second registry/);
});

test('every example passes exactly the arguments its capability requires', () => {
  for (const definition of CAPABILITY_DEFINITIONS) {
    const name = functionNameFor(definition.id);
    const example = CAPABILITY_AUTHORING_METADATA[name];
    const declared = declaredArgs(definition);
    const passed = Object.keys(example.args ?? {});

    for (const required of declared.required) {
      assert.ok(
        passed.includes(required),
        `${name} omits ${required}, which its definition requires — the example would not run`
      );
    }
    for (const argument of passed) {
      assert.ok(
        declared.all.includes(argument),
        `${name} passes ${argument}, which its definition does not declare`
      );
    }
  }
});

test('a model-backed example omits modelRef, because omission is what selects the default', () => {
  for (const definition of CAPABILITY_DEFINITIONS) {
    if ((definition.acceptedModelProfiles ?? []).length === 0) continue;
    const name = functionNameFor(definition.id);

    assert.ok(
      declaredArgs(definition).optional.includes('modelRef'),
      `${name} accepts models, so modelRef must be optional or omission would be invalid`
    );
    assert.equal(
      'modelRef' in (CAPABILITY_AUTHORING_METADATA[name].args ?? {}),
      false,
      `${name}'s example pins a model — the first shape an author meets should be the default, ` +
        'and a sentinel ModelRef would be a second way to say "default"'
    );
  }
});

test('every argument an example passes is a data-model reference, not a literal', () => {
  // The example teaches binding. A literal would teach an author to paste a
  // value where the runtime expects a path, which fails at run time and reads
  // as the Capability being broken.
  const references = (value) =>
    typeof value === 'object' &&
    value !== null &&
    (typeof value.path === 'string' || Object.values(value).every(references));

  for (const [name, example] of Object.entries(CAPABILITY_AUTHORING_METADATA)) {
    for (const [argument, value] of Object.entries(example.args ?? {})) {
      assert.ok(references(value), `${name}.${argument} is not a data-model reference`);
    }
  }
});

test('usage is generated in the shape an authored document holds', () => {
  const usage = usageExampleFor({
    functionName: 'measure_area',
    metadata: CAPABILITY_AUTHORING_METADATA.measure_area,
  });

  assert.deepEqual(usage, {
    functionCall: { call: 'measure_area', args: { mask: { path: '/working/mask' } } },
    resultPath: '/working/area',
  });
});

test('a call that routes nothing carries no resultPath at all', () => {
  // `resultPath` is Gather's action-position extension. An empty one would be a
  // third state next to present and absent.
  const usage = usageExampleFor({
    functionName: 'gather_completeComposition',
    metadata: HOST_FUNCTION_METADATA.gather_completeComposition,
  });

  assert.equal('resultPath' in usage, false);
  assert.equal(usage.functionCall.call, 'gather_completeComposition');
});

test('a function with no metadata generates nothing rather than an empty example', () => {
  assert.equal(usageExampleFor({ functionName: 'whatever', metadata: undefined }), null);
});

test('host functions carry a category, so a browser can group them without knowing Gather', () => {
  for (const [name, metadata] of Object.entries(HOST_FUNCTION_METADATA)) {
    assert.equal(typeof metadata.category, 'string', `${name} has no category`);
    assert.notEqual(metadata.category, '');
  }
});
