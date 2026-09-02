/**
 * The Accept path for an authored composition field.
 *
 * ```text
 * Accept
 *   → validate the result
 *   → required output missing?  yes → stay in the composition, write nothing
 *   → coerce all bindings
 *   → commit atomically
 *   → record provenance
 * ```
 *
 * A missing required output is a **composition completion failure**, not a
 * partially finalized instance: validation happens before any write, so an
 * invalid accepted result never crosses into XForms. That preserves the rule
 * §17 already established — no half-populated writes.
 *
 * Storage cleanup is deliberately absent. A composition declares disposition;
 * it does not know cleanup mechanics, so sweeping belongs to the instance
 * lifecycle owner at its own safe boundaries.
 * See docs/b-custom-composition-conventions.md §4 and §7.
 */

import {
  createResultFieldWriter,
  readResultValue,
} from '../resultBinding.js';
import { writerBindingsFor } from './manifest.js';

export class CompositionCommitError extends Error {
  constructor(message, { code = 'GATHER_COMPOSITION_COMMIT_ERROR', details = null } = {}) {
    super(message);
    this.name = 'CompositionCommitError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Absent for the purposes of a *required* output.
 *
 * Both `undefined` and `null` count: `toXFormsValue` clears the field for
 * either, so a required output that came back null is not a value. (The
 * writer's own `present` flag is narrower — it only reports `undefined` — and
 * that difference is deliberate rather than accidental.)
 */
const isAbsent = (value) => value === undefined || value === null;

/**
 * The required bindings this result cannot satisfy.
 *
 * @param {{ bindings?: Array<{path: string, reference: string, required?: boolean}>, result?: unknown }} input
 * @returns {Array<{path: string, reference: string}>}
 */
export const missingRequiredOutputs = ({ bindings = [], result } = {}) =>
  (bindings ?? [])
    .filter((binding) => binding?.required === true && isAbsent(readResultValue(result, binding.path)))
    .map(({ path, reference }) => ({ path, reference }));

/**
 * Commits an accepted composition result into the form.
 *
 * @param {{
 *   result: unknown,
 *   field: { reference: string, compositionId?: string, bindings: Array<object> },
 *   form: { setValue: Function },
 *   receipts?: { upsertReceipt: Function, deleteReceipt: Function }|null,
 *   receipt?: object|null,
 *   localInstanceId?: string|null,
 * }} input
 * @returns {Promise<{
 *   writes: Array<{reference: string, path: string, value: string, present: boolean}>,
 *   recorded: string[], cleared: string[],
 *   provenanceFailures: Array<{reference: string, message: string}>,
 * }>}
 */
export const commitCompositionResult = async ({
  result,
  field,
  form,
  receipts = null,
  receipt = null,
  localInstanceId = null,
} = {}) => {
  if (!field || !Array.isArray(field.bindings) || field.bindings.length === 0) {
    throw new CompositionCommitError('A composition commit needs a resolved field with bindings.', {
      code: 'GATHER_COMPOSITION_COMMIT_NO_FIELD',
    });
  }
  // Provenance is what tells a computed value apart from one typed by hand
  // (B-custom §5). A receipt store with nothing to store would silently break
  // that, so the two are required together or not at all.
  if (receipts && !receipt) {
    throw new CompositionCommitError(
      'Recording provenance needs the execution receipt that produced the result.',
      { code: 'GATHER_COMPOSITION_COMMIT_NO_RECEIPT' }
    );
  }
  if (receipts && !localInstanceId) {
    throw new CompositionCommitError('Recording provenance needs the instance it belongs to.', {
      code: 'GATHER_COMPOSITION_COMMIT_NO_INSTANCE',
    });
  }

  // 1. Validate before writing anything. Accept fails; the instance is untouched.
  const missing = missingRequiredOutputs({ bindings: field.bindings, result });
  if (missing.length > 0) {
    throw new CompositionCommitError(
      `This composition did not produce ${missing.length === 1 ? 'a required value' : 'all required values'}: ${missing
        .map((entry) => entry.path)
        .join(', ')}.`,
      { code: 'GATHER_COMPOSITION_COMMIT_REQUIRED_MISSING', details: { missing } }
    );
  }

  // 2. Commit. The writer coerces every binding before it writes any of them,
  //    so a failure here leaves nothing half-populated either.
  const writes = await createResultFieldWriter({ form, bindings: writerBindingsFor(field) })(result);

  // 3. Provenance, after the values — the data is the point, and a value with
  //    no receipt merely reads as manual, whereas a receipt with no value would
  //    claim provenance for something absent. Failures are reported rather than
  //    thrown: the values are already committed, so telling the host that
  //    Accept failed would be worse than telling it provenance is incomplete.
  const recorded = [];
  const cleared = [];
  const provenanceFailures = [];
  if (receipts) {
    for (const write of writes) {
      try {
        if (write.present) {
          await receipts.upsertReceipt({
            localInstanceId,
            bindingReference: write.reference,
            receipt,
          });
          recorded.push(write.reference);
        } else {
          // An absent optional output clears its field (§7), so its provenance
          // must go too — a receipt left behind would describe a value that is
          // no longer there.
          await receipts.deleteReceipt({ localInstanceId, bindingReference: write.reference });
          cleared.push(write.reference);
        }
      } catch (error) {
        provenanceFailures.push({
          reference: write.reference,
          message: error?.message ?? String(error),
        });
      }
    }
  }

  return { writes, recorded, cleared, provenanceFailures };
};
