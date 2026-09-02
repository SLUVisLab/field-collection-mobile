import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveCompositionDefinition,
  resolveCompositionDefinitions,
} from '../../src/xforms/compositions/definitionLoader.js';
import { parseBindingManifest, resolveCompositionFields } from '../../src/xforms/compositions/manifest.js';
import { COMPOSITION_APPEARANCE_PREFIX } from '../../src/xforms/compositions/recognition.js';

// Compositions are supplied by FORMS, never by app registration.
// See docs/a2ui-functioncall-gap.md and b-custom §6.

const definition = (overrides = {}) => ({
  id: 'authored_v1',
  catalogId: 'gather.v0-1',
  surfaceId: 'authored',
  messages: [{ version: 'v0.9', createSurface: { surfaceId: 'authored' } }],
  ...overrides,
});

const field = (overrides = {}) => ({
  reference: '/data/authored',
  compositionId: 'authored_v1',
  definitionResource: 'authored_v1.a2ui.json',
  ...overrides,
});

const attachment = (value, filename = 'authored_v1.a2ui.json') => [
  { filename, text: typeof value === 'string' ? value : JSON.stringify(value) },
];

test('a definition loads from a version-pinned form attachment', () => {
  const loaded = resolveCompositionDefinition({
    field: field(),
    attachments: [{ filename: 'plants.csv', text: 'a,b' }, ...attachment(definition())],
  });
  assert.equal(loaded.id, 'authored_v1');
  assert.equal(loaded.surfaceId, 'authored');
});

test('a field that names no definition resource is a packaging problem', () => {
  // Not "Gather has no bespoke JS for this" — a distinction that matters now
  // that handler-free compositions are the normal case.
  assert.throws(
    () => resolveCompositionDefinition({ field: field({ definitionResource: null }), attachments: [] }),
    /does not name a composition definition resource/
  );
});

test('a declared-but-absent attachment says the form is mispackaged', () => {
  assert.throws(
    () => resolveCompositionDefinition({ field: field(), attachments: [] }),
    /is not among this form version's resources/
  );
});

test('an empty or malformed attachment fails loudly', () => {
  assert.throws(
    () => resolveCompositionDefinition({ field: field(), attachments: attachment('') }),
    /present but empty/
  );
  assert.throws(
    () => resolveCompositionDefinition({ field: field(), attachments: attachment('not json') }),
    /not valid JSON/
  );
});

test('a definition that cannot render is refused before A2UIHost sees it', () => {
  for (const [missing, doc] of [
    ['id', definition({ id: undefined })],
    ['catalogId', definition({ catalogId: '' })],
    ['surfaceId', definition({ surfaceId: undefined })],
  ]) {
    assert.throws(
      () => resolveCompositionDefinition({ field: field(), attachments: attachment(doc) }),
      new RegExp(`missing '${missing}'`)
    );
  }
  assert.throws(
    () => resolveCompositionDefinition({ field: field(), attachments: attachment(definition({ messages: [] })) }),
    /no messages to render/
  );
});

test('the attachment must be the composition the group declares', () => {
  // Rendering a different composition than the field names would be worse than
  // failing, since the bindings belong to the declared one.
  assert.throws(
    () =>
      resolveCompositionDefinition({
        field: field(),
        attachments: attachment(definition({ id: 'something_else' })),
      }),
    /declares composition "something_else" but \/data\/authored names "authored_v1"/
  );
});

test('one bad attachment does not blank the whole form', () => {
  const { definitions, problems } = resolveCompositionDefinitions({
    fields: [
      field(),
      field({ reference: '/data/broken', compositionId: 'broken_v1', definitionResource: 'missing.json' }),
    ],
    attachments: attachment(definition()),
  });

  assert.equal(definitions.get('/data/authored').id, 'authored_v1');
  assert.equal(definitions.has('/data/broken'), false);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_DEFINITION_MISSING');
  assert.equal(problems[0].reference, '/data/broken');
});

test('the manifest carries the definition resource through to the resolved field', () => {
  const manifest = parseBindingManifest({
    version: 1,
    fields: [
      {
        reference: '/data/authored',
        composition: 'authored_v1',
        definition: 'authored_v1.a2ui.json',
        bindings: [{ path: 'count', reference: '/data/authored/count' }],
      },
    ],
  });
  assert.equal(manifest.fields[0].definitionResource, 'authored_v1.a2ui.json');

  const { fields } = resolveCompositionFields({
    renderModel: {
      nodes: [
        {
          reference: '/data/authored',
          nodeType: 'group',
          appearances: [`${COMPOSITION_APPEARANCE_PREFIX}authored_v1`],
        },
      ],
    },
    manifest,
  });
  assert.equal(fields[0].definitionResource, 'authored_v1.a2ui.json');
});

test('an invalid definition resource name is refused at manifest parse', () => {
  assert.throws(
    () =>
      parseBindingManifest({
        version: 1,
        fields: [
          {
            reference: '/data/a',
            composition: 'c',
            definition: '',
            bindings: [{ path: 'x', reference: '/data/a/x' }],
          },
        ],
      }),
    /invalid `definition` resource name/
  );
});
