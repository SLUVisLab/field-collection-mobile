import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';

import { Catalog } from '@a2ui/web_core/v0_9/catalog';

import {
  HOST_FUNCTION_IDS,
  createHostFunctions,
  mergeFunctions,
} from '../../src/a2ui/hostFunctions.js';
import { capabilityFunctions } from '../../src/a2ui/capabilityFunctions.js';

// Host functions enter the same Catalog.functions as capabilities, but their
// implementations are bound to the live instance by the caller.
// See docs/a2ui-functioncall-gap.md.

const capture = { uri: 'file:///tmp/shot.jpg', path: '/tmp/shot.jpg', contentType: 'image/jpeg' };

const bind = (overrides = {}) => {
  const calls = [];
  const functions = createHostFunctions({
    persistAsset: async (args) => {
      calls.push(['persistAsset', args]);
      return { assetId: 'image-1', uri: 'file:///durable.jpg', mimeType: 'image/jpeg' };
    },
    completeComposition: async (args) => {
      calls.push(['completeComposition', args]);
      return { status: 'committed', written: 2 };
    },
    ...overrides,
  });
  return { calls, catalog: new Catalog('gather.test', [], functions) };
};

test('both host functions register under stable ids', () => {
  const { catalog } = bind();
  assert.deepEqual([...catalog.functions.keys()], [
    HOST_FUNCTION_IDS.persistAsset,
    HOST_FUNCTION_IDS.completeComposition,
  ]);
  assert.deepEqual(HOST_FUNCTION_IDS, {
    persistAsset: 'gather_persistAsset',
    completeComposition: 'gather_completeComposition',
  });
});

test('only supplied implementations are registered', () => {
  // Advertising a lifecycle seam the host cannot service would fail at press
  // time instead of build time, exactly as with capabilities.
  const functions = createHostFunctions({ persistAsset: async () => ({}) });
  assert.deepEqual(functions.map((fn) => fn.name), [HOST_FUNCTION_IDS.persistAsset]);
  assert.deepEqual(createHostFunctions(), []);
});

// --- gather_persistAsset ------------------------------------------------

test('persistAsset takes a capture descriptor and returns a durable asset', async () => {
  const { catalog, calls } = bind();
  const asset = await catalog.invoker(HOST_FUNCTION_IDS.persistAsset, { capture }, {}, undefined);

  assert.deepEqual(calls[0], ['persistAsset', { capture }]);
  assert.equal(asset.assetId, 'image-1');
});

test('persistAsset accepts an authored disposition but never infers one', async () => {
  // b-custom §4: persistence is explicit authoring policy.
  const { catalog, calls } = bind();
  await catalog.invoker(HOST_FUNCTION_IDS.persistAsset, { capture, retention: 'discard' }, {}, undefined);
  assert.equal(calls[0][1].retention, 'discard');

  await assert.rejects(
    async () => catalog.invoker(HOST_FUNCTION_IDS.persistAsset, { capture, retention: 'sometimes' }, {}, undefined),
    /Validation failed/
  );
});

test('persistAsset needs a real capture descriptor', async () => {
  const { catalog } = bind();
  await assert.rejects(
    async () => catalog.invoker(HOST_FUNCTION_IDS.persistAsset, { capture: {} }, {}, undefined),
    /Validation failed/
  );
});

// --- gather_completeComposition -----------------------------------------

test('completeComposition takes declared output values', async () => {
  const { catalog, calls } = bind();
  const outputs = { count: 3, note: 'uncertain' };
  const result = await catalog.invoker(
    HOST_FUNCTION_IDS.completeComposition,
    { outputs },
    {},
    undefined
  );

  assert.deepEqual(calls[0], ['completeComposition', { outputs }]);
  assert.deepEqual(result, { status: 'committed', written: 2 });
});

test('an authored action cannot tell completeComposition where values go', async () => {
  // The form's binding manifest owns that mapping. Anything naming XForms
  // references is refused loudly rather than silently ignored.
  const { catalog, calls } = bind();

  for (const smuggled of [
    { outputs: {}, bindings: [{ path: 'count', reference: '/data/x' }] },
    { outputs: {}, reference: '/data/quadrat/count' },
    { outputs: {}, resultPath: '/data/anything' },
  ]) {
    await assert.rejects(
      async () => catalog.invoker(HOST_FUNCTION_IDS.completeComposition, smuggled, {}, undefined),
      /Validation failed/
    );
  }
  assert.deepEqual(calls, [], 'nothing reached the host');
});

test('completeComposition requires outputs', async () => {
  const { catalog } = bind();
  await assert.rejects(
    async () => catalog.invoker(HOST_FUNCTION_IDS.completeComposition, {}, {}, undefined),
    /Validation failed/
  );
});

// --- merging ------------------------------------------------------------

test('capability and host functions merge into one registration', () => {
  const host = createHostFunctions({ persistAsset: async () => ({}) });
  const merged = mergeFunctions(
    capabilityFunctions({ definitions: [], runtime: {} }),
    host
  );
  assert.deepEqual(merged.map((fn) => fn.name), [HOST_FUNCTION_IDS.persistAsset]);
});

test('a duplicate registration is refused rather than silently overwritten', () => {
  // An overwrite would make an authored call resolve to something other than
  // what the catalog advertised.
  const host = createHostFunctions({ persistAsset: async () => ({}) });
  assert.throws(() => mergeFunctions(host, host), /Duplicate A2UI function registration: gather_persistAsset/);
});

test('merging tolerates absent groups', () => {
  assert.deepEqual(mergeFunctions(undefined, null, []), []);
});
