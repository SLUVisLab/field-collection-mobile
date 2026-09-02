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
  attachMedia = null,
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

  // 2. Promote declared media projections BEFORE any XForms write.
  //
  //    A `projection: media` output is an asset whose bytes belong in the
  //    submission. The composition never learns about `instance_media`: it
  //    declared what the output *means*, and completion owns how that becomes a
  //    valid ODK instance. Attaching first preserves the standing rule that XML
  //    must never reference media that does not exist — a failure here leaves a
  //    recoverable orphan rather than a broken instance.
  const mediaBindings = (field.bindings ?? []).filter((binding) => binding.projection === 'media');
  const attachedFilenames = new Map();
  if (mediaBindings.length > 0) {
    if (typeof attachMedia !== 'function') {
      throw new CompositionCommitError(
        'This composition projects media, so completion needs an attachment seam.',
        { code: 'GATHER_COMPOSITION_COMMIT_NO_MEDIA_SEAM' }
      );
    }
    for (const binding of mediaBindings) {
      const asset = readResultValue(result, binding.path);
      if (isAbsent(asset)) continue; // optional media output, legitimately absent
      const attached = await attachMedia({ reference: binding.reference, asset });
      const filename = attached?.filename;
      if (typeof filename !== 'string' || filename.length === 0) {
        throw new CompositionCommitError(
          `Attaching ${binding.path} produced no submission filename.`,
          { code: 'GATHER_COMPOSITION_COMMIT_ATTACH_FAILED', details: { path: binding.path } }
        );
      }
      attachedFilenames.set(binding.path, filename);
    }
  }

  // 3. Commit. Scalars go through the writer, which coerces every one of them
  //    before writing any — so a mis-authored binding still cannot half-populate
  //    the instance. Media nodes then receive their *submission filename*, which
  //    is the one media identity: no Gather-internal id is serialized alongside
  //    an ODK one.
  const scalarBindings = (field.bindings ?? []).filter((binding) => binding.projection !== 'media');
  const writes =
    scalarBindings.length > 0
      ? await createResultFieldWriter({
          form,
          bindings: writerBindingsFor({ bindings: scalarBindings }),
        })(result)
      : [];

  for (const binding of mediaBindings) {
    const filename = attachedFilenames.get(binding.path);
    if (filename === undefined) {
      // An absent optional media output clears its node, like any other.
      await form.setValue(binding.reference, '');
      writes.push({ reference: binding.reference, path: binding.path, value: '', present: false });
      continue;
    }
    await form.setValue(binding.reference, filename);
    writes.push({ reference: binding.reference, path: binding.path, value: filename, present: true });
  }

  // 4. Provenance, after the values — the data is the point, and a value with
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
