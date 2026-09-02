import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';

import { Catalog } from '@a2ui/web_core/v0_9/catalog';
import { CommonSchemas } from '@a2ui/web_core/v0_9/common-schemas';
import { ComponentContext, GenericBinder } from '@a2ui/web_core/v0_9/bindings';
import { MessageProcessor } from '@a2ui/web_core/v0_9/processor';

import {
  a2uiFunctionId,
  capabilityFunctions,
  capabilityIdFor,
  returnTypeFor,
} from '../../src/a2ui/capabilityFunctions.js';
import { areaDefinition } from '../../packages/gather-capabilities/src/measure/definitions.js';
import { createCapabilityRuntime } from '../../packages/gather-capabilities/src/runtime.js';

// Slice 1 of the FunctionCall work: register Gather Capabilities as A2UI
// renderer Functions. The mechanism is already upstream — see
// docs/a2ui-functioncall-gap.md — so these tests pin the bridge, not the engine.

// --- id mapping ---------------------------------------------------------

test('semantic capability ids map to A2UI-safe function ids, reversibly', () => {
  // Capabilities keep their dotted ids; only the wire name is aliased, because
  // A2UI function identifiers follow UAX #31 where `.` is not appropriate.
  assert.equal(a2uiFunctionId('image.segment'), 'image_segment');
  assert.equal(a2uiFunctionId('measure.area'), 'measure_area');
  assert.equal(capabilityIdFor('image_segment'), 'image.segment');
  assert.equal(capabilityIdFor('measure_area'), 'measure.area');
});

test('the mapping refuses ids it could not reverse', () => {
  // `defineCapability` forbids underscores, so this is defence in depth rather
  // than a reachable case — but an ambiguous alias would be worse than a throw.
  assert.throws(() => a2uiFunctionId('image.seg_ment'), /must not contain/);
  assert.throws(() => a2uiFunctionId('notdotted'), /Not a dotted capability id/);
  assert.throws(() => capabilityIdFor('nounderscore'), /Not an A2UI capability function id/);
});

// --- returnType derivation ---------------------------------------------

test('returnType comes from the capability output schema', () => {
  assert.equal(returnTypeFor(z.number()), 'number');
  assert.equal(returnTypeFor(z.string()), 'string');
  assert.equal(returnTypeFor(z.boolean()), 'boolean');
  assert.equal(returnTypeFor(z.object({})), 'object');
  assert.equal(returnTypeFor(z.array(z.number())), 'array');
  assert.equal(returnTypeFor(z.number().optional()), 'number', 'unwraps optional');
  // Advisory metadata, so anything unrecognised degrades rather than guessing.
  assert.equal(returnTypeFor(z.union([z.string(), z.number()])), 'any');
  assert.equal(returnTypeFor(undefined), 'any');
});

// --- registration -------------------------------------------------------

// The adapter returns a map keyed by measurement name; each `measure.*`
// capability picks its own key off it.
const fakeAdapter = {
  maskMeasurements: async () => ({
    area: { value: 1234, unit: 'px^2' },
    perimeter: { value: 140, unit: 'px' },
  }),
  imageMeasurements: async () => ({ color: { srgb: [1, 2, 3] }, sharpness: { value: 0.5 } }),
};

const mask = {
  assetId: 'mask-1',
  uri: 'file:///mask.png',
  path: '/mask.png',
  width: 10,
  height: 10,
  format: 'png',
  sha256: `sha256:${'a'.repeat(64)}`,
  sourceImageAssetId: 'image-1',
};

test('only capabilities with an implementation are advertised', () => {
  // Advertising a function the runtime cannot execute would make the catalog
  // lie to the Composer agent and fail at press time instead of build time.
  const functions = capabilityFunctions({
    definitions: [areaDefinition],
    runtime: {},
  });
  assert.deepEqual(functions, []);

  const wired = capabilityFunctions({
    definitions: [areaDefinition],
    runtime: createCapabilityRuntime({ measurementAdapter: fakeAdapter }),
  });
  assert.deepEqual(wired.map((fn) => fn.name), ['measure_area']);
});

test('a real gather-capabilities implementation executes through the catalog', async () => {
  // Spike C: capability definition → A2UI function → catalog.invoker → the
  // actual measure implementation → typed serializable result.
  const functions = capabilityFunctions({
    definitions: [areaDefinition],
    runtime: createCapabilityRuntime({ measurementAdapter: fakeAdapter }),
  });
  const catalog = new Catalog('gather.test', [], functions);

  const result = await catalog.invoker('measure_area', { mask }, {}, undefined);
  assert.deepEqual(result, { value: 1234, unit: 'px^2' });
});

test('the capability input schema is the wire validation — no second schema to drift', async () => {
  const functions = capabilityFunctions({
    definitions: [areaDefinition],
    runtime: createCapabilityRuntime({ measurementAdapter: fakeAdapter }),
  });
  const catalog = new Catalog('gather.test', [], functions);

  await assert.rejects(
    async () => catalog.invoker('measure_area', { mask: { assetId: 'no-other-fields' } }, {}, undefined),
    /Validation failed for function 'measure_area'/
  );
});

test('an unknown function fails loudly rather than silently doing nothing', () => {
  const catalog = new Catalog('gather.test', [], []);
  assert.throws(
    () => catalog.invoker('measure_area', { mask }, {}, undefined),
    /Function not found in catalog 'gather.test': measure_area/
  );
});

// --- the authored action path -------------------------------------------

test('an authored action.functionCall executes the capability on interaction', async () => {
  // Proves the whole Slice 1 path with no Gather patch: registration is the
  // only thing that was missing. Laziness, path-bound arguments and
  // interaction-time execution are upstream behaviour.
  const seen = [];
  const functions = capabilityFunctions({
    definitions: [areaDefinition],
    runtime: {
      'measure.area': async (input) => {
        seen.push(input);
        return { value: 42, unit: 'px^2' };
      },
    },
  });
  const catalog = new Catalog(
    'gather.test',
    [{ name: 'Button', schema: z.object({ action: CommonSchemas.Action }) }],
    functions
  );
  const processor = new MessageProcessor([catalog], () => {});
  processor.processMessages([
    { version: 'v0.9', createSurface: { surfaceId: 's', catalogId: 'gather.test', sendDataModel: true } },
    { version: 'v0.9', updateDataModel: { surfaceId: 's', path: '/working', value: { mask } } },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 's',
        components: [
          {
            id: 'root',
            component: 'Button',
            action: {
              functionCall: { call: 'measure_area', args: { mask: { path: '/working/mask' } } },
            },
          },
        ],
      },
    },
  ]);

  const surface = processor.model.getSurface('s');
  const binder = new GenericBinder(
    new ComponentContext(surface, 'root', '/'),
    z.object({ action: CommonSchemas.Action })
  );

  assert.equal(seen.length, 0, 'nothing runs until the user acts');
  assert.equal(typeof binder.snapshot.action, 'function');

  binder.snapshot.action();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(seen.length, 1, 'the capability ran on press');
  // The argument was resolved from the data model, not passed literally.
  assert.equal(seen[0].mask.assetId, 'mask-1');
});
