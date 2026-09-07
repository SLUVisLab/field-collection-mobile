/**
 * Golden vectors — the digest **compatibility contract**, not an implementation
 * detail.
 *
 * Two things already persist these digests, so the algorithm is not freely
 * changeable:
 *
 * ```text
 * instance_receipts.revision        canonical digests, on device
 * projects/<key>/models/<digest>/   installed model directories are NAMED by revision
 * ```
 *
 * Changing canonicalization would orphan every installed model and make old
 * receipt revisions incomparable with new ones. A future "harmless cleanup"
 * therefore has to break a loud test first — that is what this file is for.
 *
 * It is deliberately **runtime-agnostic**: no test framework, no Node APIs, no
 * imports. `runHashingVectors(module)` runs identical assertions under Node,
 * Hermes and a browser, because the risk being guarded is precisely that a
 * runtime formats a number differently.
 *
 * See docs/reference/architecture/scientific-directory-retirement.md.
 */

/** Canonical form is fixed, byte for byte. */
export const CANONICAL_VECTORS = Object.freeze([
  // Key order never depends on construction order.
  { input: { b: 2, a: 1 }, expected: '{"a":1,"b":2}', why: 'keys sort' },
  { input: { a: 1, b: 2 }, expected: '{"a":1,"b":2}', why: 'same digest either way' },
  { input: {}, expected: '{}', why: 'empty object' },
  { input: [], expected: '[]', why: 'empty array' },

  // Array order is data and is NEVER sorted.
  { input: { xs: [3, 1, 2] }, expected: '{"xs":[3,1,2]}', why: 'arrays keep their order' },

  // RFC 8785 sorts by UTF-16 code unit, which is what Array#sort does.
  { input: { 'ä': 1, a: 2 }, expected: '{"a":2,"ä":1}', why: 'non-ASCII key ordering' },
  { input: { '€': 1, $: 2, A: 3 }, expected: '{"$":2,"A":3,"€":1}', why: 'symbol/letter ordering' },

  // Numbers come from ES6 Number::toString, which JCS mandates. These are the
  // cases where a runtime with its own formatter would diverge.
  { input: { n: 1e21 }, expected: '{"n":1e+21}', why: 'exponent form, upper bound' },
  { input: { n: 1e-7 }, expected: '{"n":1e-7}', why: 'exponent form, lower bound' },
  { input: { n: -0 }, expected: '{"n":0}', why: 'negative zero normalizes' },
  { input: { n: 0.1 }, expected: '{"n":0.1}', why: 'no float noise' },
  { input: { n: 1e20 }, expected: '{"n":100000000000000000000}', why: 'plain form below the cutover' },
  { input: { n: 9007199254740991 }, expected: '{"n":9007199254740991}', why: 'max safe integer' },
  { input: { n: -1.5e-9 }, expected: '{"n":-1.5e-9}', why: 'negative exponent form' },

  // Strings escape per JSON, nothing more.
  { input: { s: '' }, expected: '{"s":""}', why: 'empty string' },
  { input: { s: 'a"b\\c' }, expected: '{"s":"a\\"b\\\\c"}', why: 'quote and backslash escapes' },
  { input: { s: '\n\t' }, expected: '{"s":"\\n\\t"}', why: 'control character escapes' },
  { input: { s: '😀' }, expected: '{"s":"😀"}', why: 'astral plane survives' },

  // Nesting recurses on both shapes.
  {
    input: { outer: { z: 1, a: [{ y: 1, x: 2 }] } },
    expected: '{"outer":{"a":[{"x":2,"y":1}],"z":1}}',
    why: 'sorting is recursive, through arrays',
  },
]);

/** Digests are fixed, and bytes and values are different inputs. */
export const DIGEST_VECTORS = Object.freeze([
  {
    kind: 'canonical',
    input: {
      capability: 'image.segment',
      model: { id: 'u2netp', version: '1.0.0' },
      outputs: { area: 12.5 },
      n: [1, 2, 3],
    },
    expected: 'sha256:c3092de7c51f452c411a4a072efa35c16629cd2cb52b144194d04e47cd50189f',
    why: 'a receipt-shaped value',
  },
  {
    kind: 'canonical',
    input: {},
    expected: 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    why: 'digest of {}',
  },
  {
    kind: 'bytes',
    input: [0, 1, 2, 3, 4, 5, 6, 7],
    expected: 'sha256:8a851ff82ee7048ad09ec3847f1ddf44944104d2cbd17ef4e3db22c6785a0d45',
    why: 'known byte sequence',
  },
  {
    kind: 'bytes',
    input: [],
    expected: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    why: 'the empty-input SHA-256, a fixed point of the algorithm itself',
  },
]);

/**
 * Values that must be **refused**, not coerced.
 *
 * This is the part that is ours rather than JCS's, and the `undefined` cases
 * matter most: `JSON.stringify` silently drops `{a: undefined}` to `{}` and
 * turns `[undefined]` into `[null]`, either of which would change a digest
 * without anyone noticing.
 */
export const REJECTED_VECTORS = Object.freeze([
  { make: () => ({ n: Number.NaN }), why: 'NaN' },
  { make: () => ({ n: Infinity }), why: 'Infinity' },
  { make: () => ({ n: -Infinity }), why: '-Infinity' },
  { make: () => ({ fn: () => {} }), why: 'function' },
  { make: () => ({ d: new Date(0) }), why: 'Date would coerce to a string' },
  { make: () => ({ m: new Map() }), why: 'Map' },
  { make: () => ({ r: /x/ }), why: 'RegExp' },
  { make: () => undefined, why: 'undefined' },
  { make: () => ({ a: undefined }), why: 'undefined value — JSON.stringify would drop the key' },
  { make: () => [undefined], why: 'undefined element — JSON.stringify would write null' },
]);

/** Inputs `digestBytes` must refuse, because a digest of bytes means bytes. */
export const NON_BYTES_VECTORS = Object.freeze([
  { make: () => 'abc', why: 'string' },
  { make: () => [1, 2, 3], why: 'plain array' },
  { make: () => ({ 0: 1 }), why: 'array-like object' },
  { make: () => null, why: 'null' },
]);

/**
 * Runs every vector against a `gather-hashing` module.
 *
 * @param {{ canonicalize: Function, digestBytes: Function, digestCanonical: Function,
 *           DIGEST_ALGORITHM: string, DIGEST_PREFIX: string }} hashing
 * @returns {{ runtime: string, passed: number, failures: Array<{ case: string, detail: string }> }}
 */
export const runHashingVectors = (hashing) => {
  const failures = [];
  let passed = 0;

  const check = (name, fn) => {
    try {
      const detail = fn();
      if (detail) failures.push({ case: name, detail });
      else passed += 1;
    } catch (error) {
      failures.push({ case: name, detail: `threw ${error && error.name}: ${error && error.message}` });
    }
  };

  const throws = (fn) => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };

  for (const { input, expected, why } of CANONICAL_VECTORS) {
    check(`canonicalize ${why}`, () => {
      const got = hashing.canonicalize(input);
      return got === expected ? null : `got ${got}, expected ${expected}`;
    });
  }

  for (const { kind, input, expected, why } of DIGEST_VECTORS) {
    check(`digest ${why}`, () => {
      const got =
        kind === 'bytes'
          ? hashing.digestBytes(Uint8Array.from(input))
          : hashing.digestCanonical(input);
      return got === expected ? null : `got ${got}, expected ${expected}`;
    });
  }

  for (const { make, why } of REJECTED_VECTORS) {
    check(`reject ${why}`, () =>
      throws(() => hashing.canonicalize(make())) ? null : 'was accepted, expected a throw'
    );
    check(`reject ${why} (digest)`, () =>
      throws(() => hashing.digestCanonical(make())) ? null : 'was accepted, expected a throw'
    );
  }

  for (const { make, why } of NON_BYTES_VECTORS) {
    check(`digestBytes refuses ${why}`, () =>
      throws(() => hashing.digestBytes(make())) ? null : 'was accepted, expected a throw'
    );
  }

  check('algorithm constants', () =>
    hashing.DIGEST_ALGORITHM === 'sha256' && hashing.DIGEST_PREFIX === 'sha256:'
      ? null
      : `got ${hashing.DIGEST_ALGORITHM} / ${hashing.DIGEST_PREFIX}`
  );

  const runtime =
    typeof globalThis.HermesInternal === 'object' && globalThis.HermesInternal !== null
      ? 'hermes'
      : typeof globalThis.process === 'object' && globalThis.process?.versions?.node
        ? `node ${globalThis.process.versions.node}`
        : typeof globalThis.document === 'object'
          ? 'browser'
          : 'unknown';

  return { runtime, passed, failures };
};
