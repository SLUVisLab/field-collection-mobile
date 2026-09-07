import { canonicalize } from 'gather-hashing';

/**
 * A value can be recorded — it survives a serialization boundary unchanged.
 *
 * This is a **provenance precondition**, not a hashing primitive, which is why
 * it lives here rather than in `gather-hashing`: a receipt that cannot be
 * canonicalized cannot be given a revision, so the check belongs to the thing
 * that needs it. `canonicalize` does the work and throws; this names why.
 */
export const assertSerializableValue = (value) => {
  canonicalize(value);
  return value;
};
