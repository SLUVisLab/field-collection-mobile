import assert from 'node:assert/strict';
import test from 'node:test';

import {
  A2uiActionError,
  RESULT_PATH_KEY,
  assertSerializableResult,
  createFunctionCallHandler,
  isFunctionCallAction,
} from '../../src/a2ui/actionAdapter.js';

// Slice 2: action-position FunctionCalls execute in Gather and their result is
// pushed to an optional `resultPath`. See docs/a2ui-functioncall-gap.md.

const harness = ({ rawAction, invoke, model = {} } = {}) => {
  const writes = [];
  const errors = [];
  const handler = createFunctionCallHandler({
    rawAction,
    resolveDynamicValue: (value) =>
      value && typeof value === 'object' && 'path' in value ? model[value.path] : value,
    invoke,
    writeResult: (path, result) => writes.push([path, result]),
    onError: (error) => errors.push(error),
  });
  return { handler, writes, errors };
};

// --- what we intercept --------------------------------------------------

test('only functionCall actions are intercepted', () => {
  // Everything else — `event` above all — stays on the upstream path.
  assert.equal(isFunctionCallAction({ functionCall: { call: 'f', args: {} } }), true);
  assert.equal(isFunctionCallAction({ event: { name: 'gather.accept' } }), false);
  for (const value of [null, undefined, 'string', 42, [], { other: 1 }]) {
    assert.equal(isFunctionCallAction(value), false);
  }
});

// --- laziness and async -------------------------------------------------

test('the handler is lazy and always async, so sync capabilities work too', async () => {
  const calls = [];
  const { handler } = harness({
    rawAction: { functionCall: { call: 'double', args: { value: 21 } } },
    invoke: (name, args) => { calls.push([name, args]); return args.value * 2; },
  });

  assert.equal(calls.length, 0, 'nothing runs until the action fires');
  const result = await handler();
  assert.deepEqual(calls, [['double', { value: 21 }]]);
  assert.equal(result, 42);
});

test('arguments resolve through the A2UI context, not a second resolver', async () => {
  const { handler } = harness({
    rawAction: { functionCall: { call: 'measure_area', args: { mask: { path: '/working/mask' }, unit: 'px' } } },
    invoke: (_name, args) => args,
    model: { '/working/mask': { assetId: 'mask-1' } },
  });
  assert.deepEqual(await handler(), { mask: { assetId: 'mask-1' }, unit: 'px' });
});

// --- resultPath ---------------------------------------------------------

test('a declared resultPath receives the awaited result', async () => {
  const { handler, writes } = harness({
    rawAction: {
      functionCall: { call: 'measure_area', args: {} },
      [RESULT_PATH_KEY]: '/working/area',
    },
    invoke: async () => ({ value: 1234, unit: 'px^2' }),
  });

  await handler();
  assert.deepEqual(writes, [['/working/area', { value: 1234, unit: 'px^2' }]]);
});

test('resultPath is optional — a lifecycle call discards its return value', async () => {
  // The `gather_completeComposition` shape: execute for effect, store nothing.
  const { handler, writes } = harness({
    rawAction: { functionCall: { call: 'gather_completeComposition', args: {} } },
    invoke: async () => ({ committed: true }),
  });

  const result = await handler();
  assert.deepEqual(writes, [], 'nothing written without a resultPath');
  assert.deepEqual(result, { committed: true }, 'the caller still sees it');
});

test('a resultPath must be an absolute data-model path', () => {
  assert.throws(
    () =>
      createFunctionCallHandler({
        rawAction: { functionCall: { call: 'f', args: {} }, [RESULT_PATH_KEY]: 'working/area' },
        resolveDynamicValue: (v) => v,
        invoke: () => 1,
        writeResult: () => {},
      }),
    /must be an absolute data-model path/
  );
});

// --- failure writes nothing ---------------------------------------------

test('a capability that throws leaves resultPath untouched', async () => {
  const { handler, writes, errors } = harness({
    rawAction: { functionCall: { call: 'boom', args: {} }, [RESULT_PATH_KEY]: '/working/out' },
    invoke: async () => { throw new Error('inference failed'); },
  });

  await handler();
  assert.deepEqual(writes, [], 'no write on failure');
  assert.equal(errors.length, 1, 'the error is surfaced, not swallowed');
  assert.equal(errors[0].code, 'GATHER_A2UI_ACTION_FAILED');
  assert.match(errors[0].message, /inference failed/);
});

test('an unserializable result is refused before it can touch the data model', async () => {
  const { handler, writes, errors } = harness({
    rawAction: { functionCall: { call: 'leaky', args: {} }, [RESULT_PATH_KEY]: '/working/out' },
    invoke: async () => ({ nativeHandle: () => {} }),
  });

  await handler();
  assert.deepEqual(writes, []);
  assert.equal(errors[0].code, 'GATHER_A2UI_ACTION_NOT_SERIALIZABLE');
});

test('serializability rejects exactly what must never enter composition state', () => {
  // Plain data is fine, including nested and null.
  assert.doesNotThrow(() => assertSerializableResult({ a: [1, 'two', true, null], b: { c: 0 } }));
  assert.doesNotThrow(() => assertSerializableResult(null));

  for (const bad of [() => {}, Symbol('s'), 10n, Number.NaN, Infinity]) {
    assert.throws(() => assertSerializableResult(bad), A2uiActionError);
  }
  // A Promise means something was not awaited.
  assert.throws(() => assertSerializableResult(Promise.resolve(1)), /must be awaited/);
  // A class instance is a native handle as far as the data model is concerned.
  assert.throws(() => assertSerializableResult(new Date()), /instance/);
  const cyclic = { self: null };
  cyclic.self = cyclic;
  assert.throws(() => assertSerializableResult(cyclic), /cyclic/);
});

test('an unknown function surfaces the invoker error and writes nothing', async () => {
  // catalog.invoker throws `Function not found in catalog` — it must not be
  // mistaken for a successful call returning undefined.
  const { handler, writes, errors } = harness({
    rawAction: { functionCall: { call: 'nope', args: {} }, [RESULT_PATH_KEY]: '/working/out' },
    invoke: () => { throw new Error("Function not found in catalog 'gather': nope"); },
  });

  await handler();
  assert.deepEqual(writes, []);
  assert.match(errors[0].message, /Function not found in catalog/);
});

test('a malformed action is refused at construction, not at press time', () => {
  const base = { resolveDynamicValue: (v) => v, invoke: () => 1, writeResult: () => {} };
  assert.throws(() => createFunctionCallHandler({ ...base, rawAction: { event: { name: 'x' } } }), /Not a functionCall action/);
  assert.throws(() => createFunctionCallHandler({ ...base, rawAction: { functionCall: { args: {} } } }), /needs a function name/);
  assert.throws(
    () => createFunctionCallHandler({ rawAction: { functionCall: { call: 'f', args: {} } } }),
    /needs argument resolution and an invoker/
  );
});

// --- Spike D: a host function through the same mechanism ----------------

test('a Gather host function dispatches through the identical path', async () => {
  // Ownership stays distinct — this is the host lifecycle, not a Capability —
  // but an authored composition sees one uniform mechanism.
  const committed = [];
  const { handler, writes } = harness({
    rawAction: {
      functionCall: { call: 'gather_completeComposition', args: { outputs: { path: '/working' } } },
      [RESULT_PATH_KEY]: '/gather/completion',
    },
    invoke: async (name, args) => {
      committed.push([name, args]);
      return { status: 'committed', written: 2 };
    },
    model: { '/working': { count: 3, note: 'uncertain' } },
  });

  await handler();
  assert.deepEqual(committed, [
    ['gather_completeComposition', { outputs: { count: 3, note: 'uncertain' } }],
  ]);
  assert.deepEqual(writes, [['/gather/completion', { status: 'committed', written: 2 }]]);
});
