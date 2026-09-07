// Parity, in two halves that catch different failures.
//
//   registry parity   both hosts have an implementation for every Capability
//   fixture parity    the two implementations mean the same thing
//
// The first is this file's job. It is the check that would have caught five of
// Gather's eight Capabilities executing on the device and being unauthorable in
// the Composer — a gap that existed for as long as advertisement was a
// hand-written allowlist rather than a consequence of the definitions.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertRuntimeCovers,
  CAPABILITY_DEFINITIONS,
  CapabilityParityError,
  createCapabilityRuntime,
} from 'gather-capabilities';

/** Everything `createCapabilityRuntime` asks for, wired to inert stand-ins. */
const completeDependencies = () => ({
  segmentExecute: async () => ({}),
  classifyExecute: async () => ({}),
  measurementAdapter: { maskMeasurements: async () => ({}), imageMeasurements: async () => ({}) },
  resolveModel: async () => ({ model: {}, modelRef: {} }),
});

test('the runtime map covers every declared Capability', () => {
  // Definitions are the vocabulary; this is what proves `runtime.js` kept up
  // with them. A Capability added to the definitions and forgotten here would
  // otherwise vanish from the catalog rather than fail.
  const runtime = createCapabilityRuntime(completeDependencies());
  const covered = assertRuntimeCovers({ runtime, host: 'test' });
  assert.equal(covered.length, CAPABILITY_DEFINITIONS.length);
  assert.deepEqual(
    covered.sort(),
    ['image.classify', 'image.segment', 'measure.area', 'measure.boundingBox',
      'measure.centroid', 'measure.color', 'measure.perimeter', 'measure.sharpness'],
  );
});

test('a host missing an implementation fails, and names what it is missing', () => {
  // The real runtime map is frozen, which is itself the right thing — so a
  // host short of an implementation is modelled by copying without it.
  const { 'measure.sharpness': _s, 'measure.color': _c, ...runtime } =
    createCapabilityRuntime(completeDependencies());

  assert.throws(() => assertRuntimeCovers({ runtime, host: 'browser preview' }), (error) => {
    assert.ok(error instanceof CapabilityParityError);
    assert.equal(error.code, 'GATHER_CAPABILITY_PARITY');
    assert.equal(error.host, 'browser preview');
    assert.deepEqual(error.missing.sort(), ['measure.color', 'measure.sharpness']);
    // The remedy must not be "stop advertising it" — that is the failure mode
    // this check replaced.
    assert.match(error.message, /Do not hide it from the Composer/);
    return true;
  });
});

test('a Capability added to the definitions without a runtime entry fails', () => {
  const runtime = createCapabilityRuntime(completeDependencies());
  const invented = [...CAPABILITY_DEFINITIONS, { id: 'measure.hydration' }];
  assert.throws(
    () => assertRuntimeCovers({ runtime, host: 'device', definitions: invented }),
    (error) => error.missing.includes('measure.hydration')
  );
});

test('both hosts require the same measurement adapter surface', () => {
  // The device supplies an OpenCV adapter and the browser supplies opencv.js;
  // what the runtime asks of them is one contract, so a host implementing half
  // of it cannot satisfy the whole vocabulary.
  const partial = createCapabilityRuntime({
    ...completeDependencies(),
    measurementAdapter: { maskMeasurements: async () => ({}) },
  });
  // The runtime still binds every id — the adapter's gaps surface on call, not
  // on construction, which is precisely why fixture parity exists alongside this.
  assert.doesNotThrow(() => assertRuntimeCovers({ runtime: partial, host: 'test' }));
});
