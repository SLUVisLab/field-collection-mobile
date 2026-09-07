import { sha256 } from 'js-sha256';

/**
 * Deterministic content digests. Primitives only — no domain semantics.
 *
 * It exists because three domains need digests that agree and none of them may
 * own the others:
 *
 * ```text
 * gather-models   model revisions, artifact integrity
 * src/media       asset digests
 * src/provenance  receipt revisions
 * ```
 *
 * `gather-models` cannot import app code, so the alternatives were a copy in
 * each domain (which is what the app and `gather-capabilities` already had, and
 * they had drifted) or routing media and provenance through `gather-models` for
 * hashing, which is a worse dependency direction than a package.
 *
 * Explicitly **not** here: signatures, trust policy, key management, model or
 * media validation, receipt semantics, package verification. Those belong to
 * the domains that own them.
 */

/** The one algorithm, and the prefix every digest carries. */
export const DIGEST_ALGORITHM = 'sha256';
export const DIGEST_PREFIX = `${DIGEST_ALGORITHM}:`;

const canonicalValue = (value) => {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('A canonical value cannot contain non-finite numbers.');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    throw new TypeError('A canonical value must contain only JSON-compatible values.');
  }
  return Object.keys(value)
    .sort()
    .reduce((result, key) => ({ ...result, [key]: canonicalValue(value[key]) }), {});
};

/**
 * Key-sorted JSON, so a digest never depends on construction order.
 *
 * Gather's canonical value representation is **compatible with RFC 8785 (JCS)
 * over Gather's admitted serializable value domain** — objects, arrays,
 * strings, finite numbers, booleans and null. That is the whole claim: it is
 * not a JCS implementation, and it says nothing about values JCS handles and
 * Gather refuses.
 *
 * Within that domain the agreement is not a coincidence to be maintained but a
 * consequence: key order is UTF-16 code-unit order, which is what `Array#sort`
 * does, and numbers come from `JSON.stringify`, which already implements the
 * ES6 `Number::toString` that JCS mandates.
 *
 * Outside it, the behaviour is deliberately ours: a `Date`, a function, `NaN`,
 * `Infinity` or an `undefined` property throws rather than being coerced. That
 * last one matters most — `JSON.stringify` drops `{a: undefined}` to `{}` and
 * writes `[undefined]` as `[null]`, either of which would change a digest
 * silently.
 *
 * Pinned in `vectors.js`, and run under Node, Hermes and a browser.
 */
export const canonicalize = (value) => JSON.stringify(canonicalValue(value));

/** Digest of raw bytes — an artifact, an image, a model file. */
export const digestBytes = (bytes) => {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('digestBytes requires a Uint8Array.');
  }
  return `${DIGEST_PREFIX}${sha256(bytes)}`;
};

/** Digest of a value's canonical form — a revision. */
export const digestCanonical = (value) => `${DIGEST_PREFIX}${sha256(canonicalize(value))}`;
