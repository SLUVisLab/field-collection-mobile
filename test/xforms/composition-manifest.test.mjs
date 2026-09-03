import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPOSITION_APPEARANCE_PREFIX,
  compositionConfigFrom,
} from '../../src/xforms/compositions/recognition.js';
import {
  BINDING_MANIFEST_FILENAME,
  CompositionFieldError,
  bindingManifestFrom,
  parseBindingManifest,
  resolveCompositionFields,
  writerBindingsFor,
} from '../../src/xforms/compositions/manifest.js';

// Conventions in docs/b-custom-composition-conventions.md §1; the appearance
// syntax is verified against the engine in experiments/composition-appearance/.

// --- recognition ---------------------------------------------------------

test('the appearance token names the composition', () => {
  assert.deepEqual(compositionConfigFrom(['gather-composition:flower_v1']), {
    enabled: true,
    compositionId: 'flower_v1',
  });
  // The engine keeps the colon token verbatim, and other tokens coexist.
  assert.deepEqual(compositionConfigFrom(['field-list', 'gather-composition:flower_v1']), {
    enabled: true,
    compositionId: 'flower_v1',
  });
});

test('a group with no composition token is an ordinary group', () => {
  for (const appearances of [[], ['field-list'], null, undefined, new Set(['minimal'])]) {
    assert.equal(compositionConfigFrom(appearances).enabled, false);
  }
});

test('a token naming nothing is inert rather than bound to an empty id', () => {
  assert.deepEqual(compositionConfigFrom([COMPOSITION_APPEARANCE_PREFIX]), {
    enabled: false,
    compositionId: null,
  });
});

test('tokens are accepted from any iterable', () => {
  // The raw engine value is a Set-like iterable, not an array.
  assert.equal(
    compositionConfigFrom(new Set(['gather-composition:v2'])).compositionId,
    'v2'
  );
});

// --- manifest parsing ----------------------------------------------------

const manifest = (overrides = {}) => ({
  version: 1,
  fields: [
    {
      reference: '/data/flower_analysis',
      composition: 'flower_v1',
      bindings: [
        { path: 'petalCount', reference: '/data/flower_analysis/petal_count', required: true },
        { path: 'color.name', reference: '/data/flower_analysis/color' },
      ],
    },
  ],
  ...overrides,
});

test('a manifest maps composition outputs onto XForms references', () => {
  const parsed = parseBindingManifest(manifest());
  assert.equal(parsed.version, 1);
  assert.equal(parsed.fields.length, 1);
  assert.deepEqual(parsed.fields[0].bindings, [
    // `projection` defaults to `none`: a scalar written into the node. `media`
    // means the value is an asset whose bytes belong in the submission, which
    // is deliberately distinct from retention (b-custom §4). A scalar has no
    // asset, so it carries no disposition either.
    {
      path: 'petalCount',
      reference: '/data/flower_analysis/petal_count',
      required: true,
      projection: 'none',
      retention: null,
    },
    {
      path: 'color.name',
      reference: '/data/flower_analysis/color',
      required: false,
      projection: 'none',
      retention: null,
    },
  ]);
});

test('a media output defaults to discarding the working duplicate', () => {
  // The XForm has already said this node is a binary submission field, so a
  // durable owner other than Gather provably exists once promotion succeeds.
  // The working copy was scaffolding; `keep` is the deliberate request for a
  // duplicate. This is what lets the ordinary image case carry no Gather
  // metadata at all.
  const mediaBinding = (extra) => ({
    version: 1,
    fields: [
      {
        reference: '/data/site',
        composition: 'site_v1',
        bindings: [{ path: 'image', reference: '/data/site/image', projection: 'media', ...extra }],
      },
    ],
  });

  assert.equal(parseBindingManifest(mediaBinding()).fields[0].bindings[0].retention, 'discard');

  for (const retention of ['keep', 'discard']) {
    const parsed = parseBindingManifest(mediaBinding({ retention }));
    assert.equal(parsed.fields[0].bindings[0].retention, retention);
  }

  assert.throws(() => parseBindingManifest(mediaBinding({ retention: 'sometimes' })), (error) => {
    assert.ok(error instanceof CompositionFieldError);
    assert.equal(error.code, 'GATHER_COMPOSITION_BINDING_BAD_RETENTION');
    return true;
  });
});

test('the media default does not extend to an output with no durable destination', () => {
  // Where nothing else owns the bytes, keep vs. discard decides whether they
  // survive at all, so there is no defensible default — and Gather cannot yet
  // author such an output, so declaring one is refused rather than guessed at.
  assert.throws(
    () =>
      parseBindingManifest({
        version: 1,
        fields: [
          {
            reference: '/data/site',
            composition: 'site_v1',
            bindings: [{ path: 'note', reference: '/data/site/note', retention: 'discard' }],
          },
        ],
      }),
    /no durable XForms destination/
  );
});

test('a manifest parses from JSON text as it ships', () => {
  const parsed = parseBindingManifest(JSON.stringify(manifest()));
  assert.equal(parsed.fields[0].composition, 'flower_v1');
});

test('bindings come out in the shape the result writer already consumes', () => {
  // §17's createResultFieldWriter takes { reference, path } — no translation.
  const parsed = parseBindingManifest(manifest());
  assert.deepEqual(writerBindingsFor(parsed.fields[0]), [
    { reference: '/data/flower_analysis/petal_count', path: 'petalCount' },
    { reference: '/data/flower_analysis/color', path: 'color.name' },
  ]);
  assert.deepEqual(writerBindingsFor(null), []);
});

test('a mis-authored manifest fails loudly rather than projecting nothing', () => {
  const bad = (fields) => () => parseBindingManifest({ version: 1, fields });

  assert.throws(() => parseBindingManifest('not json'), CompositionFieldError);
  assert.throws(() => parseBindingManifest([]), CompositionFieldError);
  assert.throws(() => parseBindingManifest({ version: 99, fields: [] }), /Unsupported binding manifest version/);
  assert.throws(() => parseBindingManifest({ version: 1 }), /needs a `fields` array/);
  assert.throws(bad([{ composition: 'c', bindings: [] }]), /needs the `reference`/);
  assert.throws(bad([{ reference: '/data/g', bindings: [{ path: 'a', reference: '/data/g/a' }] }]), /needs a `composition` id/);
  assert.throws(bad([{ reference: '/data/g', composition: 'c' }]), /at least one binding/);
  assert.throws(bad([{ reference: '/data/g', composition: 'c', bindings: [] }]), /at least one binding/);
  assert.throws(
    bad([{ reference: '/data/g', composition: 'c', bindings: [{ reference: '/data/g/a' }] }]),
    /needs a `path`/
  );
  assert.throws(
    bad([{ reference: '/data/g', composition: 'c', bindings: [{ path: 'a' }] }]),
    /needs an XForms `reference`/
  );
});

test('a composition may only write inside its own group', () => {
  // Writing outside would land in fields Gather does not hide (§5), so values
  // would appear with nothing explaining where they came from.
  assert.throws(
    () =>
      parseBindingManifest({
        version: 1,
        fields: [
          {
            reference: '/data/flower_analysis',
            composition: 'flower_v1',
            bindings: [{ path: 'petalCount', reference: '/data/somewhere_else' }],
          },
        ],
      }),
    /only write inside its own group/
  );
  // A prefix that is not a path boundary is still outside.
  assert.throws(
    () =>
      parseBindingManifest({
        version: 1,
        fields: [
          {
            reference: '/data/flower',
            composition: 'c',
            bindings: [{ path: 'a', reference: '/data/flower_notes/a' }],
          },
        ],
      }),
    /only write inside its own group/
  );
});

test('two outputs must not bind the same field, but one output may feed two', () => {
  assert.throws(
    () =>
      parseBindingManifest({
        version: 1,
        fields: [
          {
            reference: '/data/g',
            composition: 'c',
            bindings: [
              { path: 'a', reference: '/data/g/x' },
              { path: 'b', reference: '/data/g/x' },
            ],
          },
        ],
      }),
    /binds \/data\/g\/x more than once/
  );

  const shared = parseBindingManifest({
    version: 1,
    fields: [
      {
        reference: '/data/g',
        composition: 'c',
        bindings: [
          { path: 'area', reference: '/data/g/x' },
          { path: 'area', reference: '/data/g/y' },
        ],
      },
    ],
  });
  assert.equal(shared.fields[0].bindings.length, 2);
});

test('a group cannot be configured twice', () => {
  assert.throws(
    () =>
      parseBindingManifest({
        version: 1,
        fields: [
          { reference: '/data/g', composition: 'c', bindings: [{ path: 'a', reference: '/data/g/a' }] },
          { reference: '/data/g', composition: 'c', bindings: [{ path: 'b', reference: '/data/g/b' }] },
        ],
      }),
    /configures \/data\/g more than once/
  );
});

// --- attachment discovery ------------------------------------------------

test('the manifest is found among the form version attachments', () => {
  const parsed = bindingManifestFrom([
    { filename: 'plants.csv', text: 'a,b' },
    { filename: BINDING_MANIFEST_FILENAME, text: JSON.stringify(manifest()) },
  ]);
  assert.equal(parsed.fields[0].composition, 'flower_v1');
});

test('a form with no composition fields legitimately ships no manifest', () => {
  assert.equal(bindingManifestFrom([{ filename: 'plants.csv', text: 'a,b' }]), null);
  assert.equal(bindingManifestFrom([]), null);
  assert.equal(bindingManifestFrom(), null);
});

test('a present-but-empty manifest is an error, not an absent one', () => {
  assert.throws(
    () => bindingManifestFrom([{ filename: BINDING_MANIFEST_FILENAME, text: '' }]),
    /present but empty/
  );
});

// --- resolution against the form ----------------------------------------

const groupNode = (reference, compositionId) => ({
  reference,
  nodeType: 'group',
  appearances: compositionId ? [`${COMPOSITION_APPEARANCE_PREFIX}${compositionId}`] : [],
});

test('a declared composition resolves to its bindings', () => {
  const { fields, problems } = resolveCompositionFields({
    renderModel: {
      nodes: [
        { reference: '/data/site', nodeType: 'input', appearances: [] },
        groupNode('/data/flower_analysis', 'flower_v1'),
      ],
    },
    manifest: parseBindingManifest(manifest()),
  });

  assert.deepEqual(problems, []);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].compositionId, 'flower_v1');
  assert.equal(fields[0].bindings.length, 2);
});

test('a composition with no manifest entry is a problem, not an empty field', () => {
  // The failure mode this whole module exists to prevent.
  const { fields, problems } = resolveCompositionFields({
    renderModel: { nodes: [groupNode('/data/flower_analysis', 'flower_v1')] },
    manifest: null,
  });

  assert.deepEqual(fields, []);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_NO_MANIFEST_ENTRY');
  assert.match(problems[0].message, /has no entry for it/);
});

test('a composition id that disagrees with the manifest is a problem', () => {
  const { fields, problems } = resolveCompositionFields({
    renderModel: { nodes: [groupNode('/data/flower_analysis', 'flower_v2')] },
    manifest: parseBindingManifest(manifest()),
  });
  assert.deepEqual(fields, []);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_ID_MISMATCH');
});

test('a manifest entry nothing declares is surfaced as dead configuration', () => {
  const { fields, problems } = resolveCompositionFields({
    renderModel: { nodes: [groupNode('/data/flower_analysis', null)] },
    manifest: parseBindingManifest(manifest()),
  });
  assert.deepEqual(fields, []);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_UNUSED_MANIFEST_ENTRY');
});

test('the appearance must be on a group', () => {
  const { fields, problems } = resolveCompositionFields({
    renderModel: {
      nodes: [
        {
          reference: '/data/flower_analysis',
          nodeType: 'input',
          appearances: ['gather-composition:flower_v1'],
        },
      ],
    },
    manifest: parseBindingManifest(manifest()),
  });
  assert.deepEqual(fields, []);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_NOT_A_GROUP');
});

test('a form with neither compositions nor a manifest resolves quietly', () => {
  const { fields, problems } = resolveCompositionFields({
    renderModel: { nodes: [{ reference: '/data/site', nodeType: 'input', appearances: [] }] },
    manifest: null,
  });
  assert.deepEqual(fields, []);
  assert.deepEqual(problems, []);
  assert.deepEqual(resolveCompositionFields(), { fields: [], problems: [] });
});

test('two composition fields in one form each resolve to their own bindings', () => {
  const twoFields = {
    version: 1,
    fields: [
      { reference: '/data/a', composition: 'c1', bindings: [{ path: 'x', reference: '/data/a/x' }] },
      { reference: '/data/b', composition: 'c2', bindings: [{ path: 'y', reference: '/data/b/y' }] },
    ],
  };
  const { fields, problems } = resolveCompositionFields({
    renderModel: { nodes: [groupNode('/data/a', 'c1'), groupNode('/data/b', 'c2')] },
    manifest: parseBindingManifest(twoFields),
  });
  assert.deepEqual(problems, []);
  assert.deepEqual(fields.map((f) => f.compositionId), ['c1', 'c2']);
});

test('a JSON attachment reaches us as text, which manifest discovery depends on', async () => {
  // bindingManifestFrom reads `text`, and formCatalogService decides text vs
  // base64 by content type. If `json` were dropped from that predicate the
  // manifest would arrive base64-encoded and silently never be found — so the
  // coupling is asserted here rather than assumed.
  const { isTextResource } = await import('../../src/forms/formCatalogService.js');
  assert.equal(isTextResource({ contentType: 'application/json' }), true);
  assert.equal(isTextResource({ contentType: 'image/jpeg' }), false);
});

test('an unsupported projection is refused rather than silently treated as scalar', () => {
  assert.throws(
    () =>
      parseBindingManifest({
        version: 1,
        fields: [
          {
            reference: '/data/g',
            composition: 'c',
            bindings: [{ path: 'x', reference: '/data/g/x', projection: 'attachment' }],
          },
        ],
      }),
    /unsupported projection/
  );
});
