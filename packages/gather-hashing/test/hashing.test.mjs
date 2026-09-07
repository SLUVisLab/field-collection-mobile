import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DIGEST_ALGORITHM,
  DIGEST_PREFIX,
  canonicalize,
  digestBytes,
  digestCanonical,
} from '../src/index.js';

test('a digest never depends on construction order', () => {
  // The property the whole package exists for: a model revision computed in
  // gather-models and a receipt revision computed in the app must agree.
  assert.equal(canonicalize({ b: 1, a: 2 }), canonicalize({ a: 2, b: 1 }));
  assert.equal(digestCanonical({ b: 1, a: 2 }), digestCanonical({ a: 2, b: 1 }));
  assert.equal(canonicalize({ outer: { z: 1, a: [{ y: 1, x: 2 }] } }), '{"outer":{"a":[{"x":2,"y":1}],"z":1}}');
});

test('canonical output matches RFC 8785 where it matters', () => {
  // Sorted JSON.stringify already IS JCS over the values we admit: key order is
  // UTF-16 code units, and numbers come out of ES6 Number::toString.
  assert.equal(canonicalize({ 'ä': 1, a: 2 }), '{"a":2,"ä":1}');
  assert.equal(canonicalize({ '€': 1, $: 2, A: 3 }), '{"$":2,"A":3,"€":1}');
  assert.equal(canonicalize({ n: 1e21 }), '{"n":1e+21}');
  assert.equal(canonicalize({ n: 1e-7 }), '{"n":1e-7}');
  assert.equal(canonicalize({ n: -0 }), '{"n":0}');
  assert.equal(canonicalize({ n: 0.1 }), '{"n":0.1}');
});

test('a value that cannot round-trip cannot be hashed', () => {
  // The part that is ours rather than JCS's: refusal instead of coercion.
  for (const value of [{ n: Number.NaN }, { n: Infinity }, { fn: () => {} }, { d: new Date() }]) {
    assert.throws(() => canonicalize(value), TypeError);
    assert.throws(() => digestCanonical(value), TypeError);
  }
});

test('bytes and values are different inputs, and say so', () => {
  // sha256For used to take either, which hid the distinction at every call
  // site. A digest of bytes and a digest of a description are not the same
  // claim about a thing.
  assert.equal(
    digestBytes(new Uint8Array([1, 2, 3])),
    'sha256:039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81'
  );
  assert.throws(() => digestBytes('abc'), TypeError);
  assert.throws(() => digestBytes([1, 2, 3]), TypeError);
  assert.equal(DIGEST_ALGORITHM, 'sha256');
  assert.ok(digestCanonical({ a: 1 }).startsWith(DIGEST_PREFIX));
});
