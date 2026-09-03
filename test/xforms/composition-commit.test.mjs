import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CompositionCommitError,
  commitCompositionResult,
  missingRequiredOutputs,
} from '../../src/xforms/compositions/commit.js';
import { parseBindingManifest } from '../../src/xforms/compositions/manifest.js';

// docs/b-custom-composition-conventions.md §7: a missing required output is a
// composition completion failure, not a partially finalized instance.

const field = (bindings) => ({ reference: '/data/flower', compositionId: 'flower_v1', bindings });

const resolvedField = () =>
  parseBindingManifest({
    version: 1,
    fields: [
      {
        reference: '/data/flower',
        composition: 'flower_v1',
        bindings: [
          { path: 'petalCount', reference: '/data/flower/petal_count', required: true },
          { path: 'color.name', reference: '/data/flower/color' },
        ],
      },
    ],
  }).fields[0];

const makeForm = () => {
  const writes = [];
  return { writes, setValue: async (reference, value) => writes.push([reference, value]) };
};

const makeReceipts = () => {
  const rows = new Map();
  return {
    rows,
    upsertReceipt: async ({ bindingReference, receipt }) => rows.set(bindingReference, receipt),
    deleteReceipt: async ({ bindingReference }) => rows.delete(bindingReference),
  };
};

const receipt = { capability: 'image.classify', capabilityRevision: 'r1', revision: 'd1' };

// --- required-output validation -----------------------------------------

test('required outputs are checked before anything is written', () => {
  const bindings = resolvedField().bindings;
  assert.deepEqual(missingRequiredOutputs({ bindings, result: { petalCount: 7 } }), []);
  assert.deepEqual(missingRequiredOutputs({ bindings, result: {} }), [
    { path: 'petalCount', reference: '/data/flower/petal_count' },
  ]);
});

test('a required output of null is missing, not present', () => {
  // toXFormsValue clears the field for null as well as undefined, so a
  // required value that came back null is not a value.
  const bindings = resolvedField().bindings;
  assert.equal(missingRequiredOutputs({ bindings, result: { petalCount: null } }).length, 1);
  // Falsy-but-real values are present.
  assert.deepEqual(missingRequiredOutputs({ bindings, result: { petalCount: 0 } }), []);
  assert.deepEqual(missingRequiredOutputs({ bindings, result: { petalCount: false } }), []);
  assert.deepEqual(missingRequiredOutputs({ bindings, result: { petalCount: '' } }), []);
});

test('an optional output may be absent without complaint', () => {
  assert.deepEqual(
    missingRequiredOutputs({ bindings: resolvedField().bindings, result: { petalCount: 7 } }),
    []
  );
});

// --- the Accept path ----------------------------------------------------

test('Accept commits every binding and records provenance for each', async () => {
  const form = makeForm();
  const receipts = makeReceipts();

  const outcome = await commitCompositionResult({
    result: { petalCount: 7, color: { name: 'yellow' } },
    field: resolvedField(),
    form,
    receipts,
    receipt,
    localInstanceId: 'i-1',
  });

  assert.deepEqual(form.writes, [
    ['/data/flower/petal_count', '7'],
    ['/data/flower/color', 'yellow'],
  ]);
  assert.deepEqual(outcome.recorded, ['/data/flower/petal_count', '/data/flower/color']);
  assert.deepEqual(outcome.cleared, []);
  assert.deepEqual(outcome.provenanceFailures, []);
  // Every projected field can now answer "was this computed?" — principle 5.
  assert.equal(receipts.rows.get('/data/flower/color'), receipt);
});

test('a missing required output fails Accept and writes nothing at all', async () => {
  const form = makeForm();
  const receipts = makeReceipts();

  await assert.rejects(
    () =>
      commitCompositionResult({
        result: { color: { name: 'yellow' } },
        field: resolvedField(),
        form,
        receipts,
        receipt,
        localInstanceId: 'i-1',
      }),
    (error) => {
      assert.ok(error instanceof CompositionCommitError);
      assert.equal(error.code, 'GATHER_COMPOSITION_COMMIT_REQUIRED_MISSING');
      assert.deepEqual(error.details.missing, [
        { path: 'petalCount', reference: '/data/flower/petal_count' },
      ]);
      return true;
    }
  );

  // The instance is untouched: no partial write, no provenance.
  assert.deepEqual(form.writes, []);
  assert.equal(receipts.rows.size, 0);
});

test('an absent optional output clears its field and its provenance', async () => {
  // §7: clear any previous projected value, and the receipt must not outlive it.
  const form = makeForm();
  const receipts = makeReceipts();
  receipts.rows.set('/data/flower/color', { stale: true });

  const outcome = await commitCompositionResult({
    result: { petalCount: 7 },
    field: resolvedField(),
    form,
    receipts,
    receipt,
    localInstanceId: 'i-1',
  });

  assert.deepEqual(form.writes, [
    ['/data/flower/petal_count', '7'],
    ['/data/flower/color', ''],
  ]);
  assert.deepEqual(outcome.cleared, ['/data/flower/color']);
  assert.equal(receipts.rows.has('/data/flower/color'), false, 'stale provenance is dropped');
});

test('a structured value is refused before it can reach a field', async () => {
  // §17's guard: this is what keeps an ImageAsset out of a text field.
  const form = makeForm();
  await assert.rejects(
    () =>
      commitCompositionResult({
        result: { petalCount: { count: 7 } },
        field: resolvedField(),
        form,
      }),
    /Only scalar values/
  );
  assert.deepEqual(form.writes, [], 'coercion happens before any write');
});

test('provenance failures are reported, not thrown — the values are committed', async () => {
  // Telling the host that Accept failed would be worse than telling it
  // provenance is incomplete, because the data is already in the form.
  const form = makeForm();
  const outcome = await commitCompositionResult({
    result: { petalCount: 7, color: { name: 'yellow' } },
    field: resolvedField(),
    form,
    receipts: {
      upsertReceipt: async () => { throw new Error('disk full'); },
      deleteReceipt: async () => {},
    },
    receipt,
    localInstanceId: 'i-1',
  });

  assert.equal(form.writes.length, 2, 'the values still landed');
  assert.deepEqual(outcome.recorded, []);
  assert.equal(outcome.provenanceFailures.length, 2);
  assert.equal(outcome.provenanceFailures[0].message, 'disk full');
});

test('committing without a receipt store simply skips provenance', async () => {
  const form = makeForm();
  const outcome = await commitCompositionResult({
    result: { petalCount: 7, color: { name: 'yellow' } },
    field: resolvedField(),
    form,
  });
  assert.equal(form.writes.length, 2);
  assert.deepEqual(outcome.recorded, []);
  assert.deepEqual(outcome.provenanceFailures, []);
});

test('a receipt store with nothing to store is refused rather than silently skipped', async () => {
  // Otherwise principle 5 would quietly not hold for this field.
  const form = makeForm();
  await assert.rejects(
    () => commitCompositionResult({ result: { petalCount: 7 }, field: resolvedField(), form, receipts: makeReceipts(), localInstanceId: 'i-1' }),
    /needs the execution receipt/
  );
  await assert.rejects(
    () => commitCompositionResult({ result: { petalCount: 7 }, field: resolvedField(), form, receipts: makeReceipts(), receipt }),
    /needs the instance it belongs to/
  );
  assert.deepEqual(form.writes, []);
});

test('a field with no bindings cannot be committed', async () => {
  await assert.rejects(
    () => commitCompositionResult({ result: {}, field: field([]), form: makeForm() }),
    /needs a resolved field with bindings/
  );
  await assert.rejects(
    () => commitCompositionResult({ result: {}, form: makeForm() }),
    /needs a resolved field with bindings/
  );
});

// --- media projection ---------------------------------------------------

const mediaField = () =>
  parseBindingManifest({
    version: 1,
    fields: [
      {
        reference: '/data/site',
        composition: 'authored_v1',
        bindings: [
          { path: 'note', reference: '/data/site/note' },
          {
            path: 'image',
            reference: '/data/site/image',
            projection: 'media',
            required: true,
            retention: 'discard',
          },
        ],
      },
    ],
  }).fields[0];

test('a media projection becomes a real submission attachment, not an asset blob', async () => {
  // The composition declared what the output MEANS; completion owns how it
  // becomes a valid ODK instance. One media identity: the ODK filename.
  const form = makeForm();
  const attached = [];

  const outcome = await commitCompositionResult({
    result: { note: 'north face', image: { assetId: 'image-1', fileKey: 'projects/p/media/image-1.jpg' } },
    field: mediaField(),
    form,
    attachMedia: async ({ reference, asset }) => {
      attached.push([reference, asset.assetId]);
      return { filename: 'IMG_1234.jpg' };
    },
  });

  assert.deepEqual(attached, [['/data/site/image', 'image-1']]);
  assert.deepEqual(form.writes, [
    ['/data/site/note', 'north face'],
    ['/data/site/image', 'IMG_1234.jpg'],
  ]);
  assert.equal(outcome.writes.find((w) => w.path === 'image').value, 'IMG_1234.jpg');
});

test('a promoted asset is settled only after the commit succeeds', async () => {
  // The disposition the binding declared is applied once the XML and the
  // submission's copy both exist. Releasing earlier could hand a sweep bytes
  // the instance still needs.
  const form = makeForm();
  const order = [];
  const settled = [];

  const outcome = await commitCompositionResult({
    result: { note: 'n', image: { assetId: 'image-1', fileKey: 'projects/p/media/image-1.jpg' } },
    field: mediaField(),
    form: {
      setValue: async (reference, value) => {
        order.push(`write:${reference}`);
        form.writes.push([reference, value]);
      },
    },
    attachMedia: async () => {
      order.push('attach');
      return { filename: 'IMG_1234.jpg' };
    },
    applyDisposition: async ({ asset, retention }) => {
      order.push('settle');
      settled.push([asset.fileKey, retention]);
    },
  });

  assert.deepEqual(settled, [['projects/p/media/image-1.jpg', 'discard']]);
  assert.equal(order[0], 'attach');
  assert.equal(order.at(-1), 'settle', 'disposition is settled last, after every write');
  assert.deepEqual(outcome.dispositions, [{ reference: '/data/site/image', retention: 'discard' }]);
  assert.deepEqual(outcome.dispositionFailures, []);
});

test('a keep disposition reaches the seam unchanged, so a duplicate is deliberate', async () => {
  const form = makeForm();
  const settled = [];
  const keepField = parseBindingManifest({
    version: 1,
    fields: [
      {
        reference: '/data/site',
        composition: 'authored_v1',
        bindings: [
          { path: 'image', reference: '/data/site/image', projection: 'media', retention: 'keep' },
        ],
      },
    ],
  }).fields[0];

  await commitCompositionResult({
    result: { image: { assetId: 'image-1', fileKey: 'projects/p/media/image-1.jpg' } },
    field: keepField,
    form,
    attachMedia: async () => ({ filename: 'IMG_1234.jpg' }),
    applyDisposition: async ({ retention }) => settled.push(retention),
  });

  assert.deepEqual(settled, ['keep']);
});

test('an absent optional media output settles nothing', async () => {
  // Nothing was promoted, so there is no working asset to dispose of.
  const form = makeForm();
  const settled = [];
  const optionalField = parseBindingManifest({
    version: 1,
    fields: [
      {
        reference: '/data/site',
        composition: 'authored_v1',
        bindings: [
          { path: 'image', reference: '/data/site/image', projection: 'media', retention: 'discard' },
        ],
      },
    ],
  }).fields[0];

  const outcome = await commitCompositionResult({
    result: {},
    field: optionalField,
    form,
    attachMedia: async () => ({ filename: 'never.jpg' }),
    applyDisposition: async ({ retention }) => settled.push(retention),
  });

  assert.deepEqual(settled, []);
  assert.deepEqual(form.writes, [['/data/site/image', '']], 'the node is cleared, as always');
  assert.deepEqual(outcome.dispositions, []);
});

test('a failed disposition is reported, never thrown: the values are already committed', async () => {
  // Same bias as provenance. An unsettled disposition leaves bytes behind; a
  // thrown Accept would tell the researcher their data did not land.
  const form = makeForm();
  const outcome = await commitCompositionResult({
    result: { note: 'n', image: { assetId: 'image-1', fileKey: 'k' } },
    field: mediaField(),
    form,
    attachMedia: async () => ({ filename: 'IMG_1234.jpg' }),
    applyDisposition: async () => { throw new Error('ledger is locked'); },
  });

  assert.deepEqual(
    form.writes,
    [['/data/site/note', 'n'], ['/data/site/image', 'IMG_1234.jpg']],
    'every value still landed'
  );
  assert.deepEqual(outcome.dispositions, []);
  assert.deepEqual(outcome.dispositionFailures, [
    { reference: '/data/site/image', message: 'ledger is locked' },
  ]);
});

test('a declared disposition with no seam to apply it is reported, not silently dropped', async () => {
  const form = makeForm();
  const outcome = await commitCompositionResult({
    result: { note: 'n', image: { assetId: 'image-1', fileKey: 'k' } },
    field: mediaField(),
    form,
    attachMedia: async () => ({ filename: 'IMG_1234.jpg' }),
  });

  assert.equal(outcome.dispositionFailures.length, 1);
  assert.match(outcome.dispositionFailures[0].message, /no disposition seam/);
});

test('attachment happens before any XForms write, so XML never points at missing media', async () => {
  const form = makeForm();
  await assert.rejects(
    () =>
      commitCompositionResult({
        result: { note: 'north face', image: { assetId: 'image-1' } },
        field: mediaField(),
        form,
        attachMedia: async () => { throw new Error('no space left on device'); },
      }),
    /no space left on device/
  );
  assert.deepEqual(form.writes, [], 'not even the scalar was written');
});

test('an attachment that yields no filename is a failure, not a silent empty node', async () => {
  const form = makeForm();
  await assert.rejects(
    () =>
      commitCompositionResult({
        result: { note: 'n', image: { assetId: 'image-1' } },
        field: mediaField(),
        form,
        attachMedia: async () => ({}),
      }),
    /produced no submission filename/
  );
  assert.deepEqual(form.writes, []);
});

test('a composition that projects media cannot commit without an attachment seam', async () => {
  const form = makeForm();
  await assert.rejects(
    () =>
      commitCompositionResult({
        result: { note: 'n', image: { assetId: 'image-1' } },
        field: mediaField(),
        form,
      }),
    /needs an attachment seam/
  );
  assert.deepEqual(form.writes, []);
});

test('a required media output that is absent fails before anything is attached', async () => {
  const form = makeForm();
  const attached = [];
  await assert.rejects(
    () =>
      commitCompositionResult({
        result: { note: 'n' },
        field: mediaField(),
        form,
        attachMedia: async () => { attached.push(1); return { filename: 'x.jpg' }; },
      }),
    /did not produce a required value/
  );
  assert.deepEqual(attached, [], 'required validation runs before attachment');
  assert.deepEqual(form.writes, []);
});

test('scalar-only compositions need no attachment seam at all', async () => {
  const form = makeForm();
  await commitCompositionResult({ result: { petalCount: 7 }, field: resolvedField(), form });
  assert.equal(form.writes.length, 2);
});
