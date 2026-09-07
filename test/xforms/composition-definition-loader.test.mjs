import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveCompositionDefinition,
  resolveCompositionDefinitions,
} from '../../src/xforms/compositions/definitionLoader.js';
import { resolveCompositionFields } from '../../src/xforms/compositions/compositionBinding.js';
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
    /does not name a composition resource. Set gather:composition/
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

test('the group names its own definition resource', () => {
  // `body::gather:composition` on the group. No side-car document names it, and
  // a jr:// form is reduced to its basename because the same file is separately
  // declared to Central as a jr:// reference.
  const groupWith = (composition) => ({
    renderModel: {
      nodes: [
        {
          reference: '/data/authored',
          nodeType: 'group',
          appearances: ['gather-composition'],
          gather: { composition },
        },
        {
          reference: '/data/authored/count',
          nodeType: 'input',
          valueType: 'int',
          parentReference: '/data/authored',
          bodyBacked: true,
        },
      ],
    },
  });

  assert.equal(
    resolveCompositionFields(groupWith('authored_v1.a2ui.json')).fields[0].definitionResource,
    'authored_v1.a2ui.json'
  );
  assert.equal(
    resolveCompositionFields(groupWith('jr://images/authored_v1.a2ui.json')).fields[0].definitionResource,
    'authored_v1.a2ui.json'
  );
});

test('a composition naming neither a resource nor a registered id is a problem, not a guess', () => {
  const { fields, problems } = resolveCompositionFields({
    renderModel: {
      nodes: [
        { reference: '/data/authored', nodeType: 'group', appearances: ['gather-composition'] },
        {
          reference: '/data/authored/count',
          nodeType: 'input',
          parentReference: '/data/authored',
          bodyBacked: true,
        },
      ],
    },
  });
  assert.deepEqual(fields, []);
  assert.equal(problems[0].code, 'GATHER_COMPOSITION_NO_RESOURCE');
});

test('the artifact is the authority on its own id when the group names none', () => {
  // `gather-composition` names no id — the canonical form. Comparing the
  // artifact's id against a null claim reported a mismatch against "null" and
  // made every handler-free composition unavailable. Found on device.
  const resolved = resolveCompositionDefinition({
    field: { reference: '/data/authored', compositionId: null, definitionResource: 'authored_v1.a2ui.json' },
    attachments: attachment(definition()),
  });
  assert.equal(resolved.id, 'authored_v1');
});

test('a group that DOES name an id must agree with the artifact', () => {
  // The id-bearing appearance is for a composition this build registered, so
  // two claims exist and pointing at a different artifact is a real error.
  assert.throws(
    () =>
      resolveCompositionDefinition({
        field: {
          reference: '/data/authored',
          compositionId: 'something_else',
          definitionResource: 'authored_v1.a2ui.json',
        },
        attachments: attachment(definition()),
      }),
    /declares composition "authored_v1" but \/data\/authored names "something_else"/
  );
});
