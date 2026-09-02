import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MULTI_IMAGE_APPEARANCE,
  collectionItemsFrom,
  instancePositionOf,
  multiImageConfigFrom,
  orderedInstanceReferences,
  orphanedFilenames,
} from '../../src/xforms/collectionField.js';

// Conventions verified against the engine in experiments/appearance-parameters/
// and settled in docs/b-standard-field-conventions.md.

test('the appearance token turns an ordinary repeat into a collection field', () => {
  assert.equal(multiImageConfigFrom([MULTI_IMAGE_APPEARANCE]).enabled, true);
  assert.equal(multiImageConfigFrom(['field-list']).enabled, false);
  assert.equal(multiImageConfigFrom([]).enabled, false);
  assert.equal(multiImageConfigFrom(null).enabled, false);
});

test('cardinality comes from key=value appearance parameters', () => {
  // Exactly the token order the engine produces.
  const config = multiImageConfigFrom(['gather-multi-image', 'min=2', 'max=6']);
  assert.deepEqual(config, { enabled: true, minItems: 2, maxItems: 6 });
});

test('an exact-count field is just min === max', () => {
  assert.deepEqual(multiImageConfigFrom(['gather-multi-image', 'min=4', 'max=4']), {
    enabled: true,
    minItems: 4,
    maxItems: 4,
  });
});

test('absent or unusable cardinality degrades to unbounded rather than trapping', () => {
  assert.deepEqual(multiImageConfigFrom(['gather-multi-image']), {
    enabled: true, minItems: 0, maxItems: null,
  });
  // A max below the min would be unsatisfiable — better unbounded than a
  // control the researcher can never complete.
  assert.deepEqual(multiImageConfigFrom(['gather-multi-image', 'min=5', 'max=2']), {
    enabled: true, minItems: 5, maxItems: null,
  });
  assert.equal(multiImageConfigFrom(['gather-multi-image', 'max=nonsense']).maxItems, null);
  assert.equal(multiImageConfigFrom(['gather-multi-image', 'max=0']).maxItems, null);
});

test('tokens are accepted from any iterable, and order does not matter', () => {
  // The raw engine value is a Set-like iterable, not an array.
  const asSet = new Set(['max=3', 'gather-multi-image', 'min=1']);
  assert.deepEqual(multiImageConfigFrom(asSet), { enabled: true, minItems: 1, maxItems: 3 });
});

test('instances order by position, not lexically', () => {
  assert.equal(instancePositionOf('/data/photos[2]'), 2);
  assert.equal(instancePositionOf('/data/photos'), null);
  // Lexical sort would put [10] before [2].
  const ordered = orderedInstanceReferences([
    '/data/photos[10]', '/data/photos[2]', '/data/photos[1]', '/data/photos',
  ]);
  assert.deepEqual(ordered, ['/data/photos[1]', '/data/photos[2]', '/data/photos[10]']);
});

const mediaRows = [
  { filename: 'image-a.jpg', contentType: 'image/jpeg', fileKey: 'projects/p/media/i/image-a.jpg' },
  { filename: 'image-b.jpg', contentType: 'image/jpeg', fileKey: 'projects/p/media/i/image-b.jpg' },
];

test('the repeat projects into an ImageAsset-shaped value view', () => {
  const items = collectionItemsFrom({
    instanceReferences: ['/data/photos[1]', '/data/photos[2]'],
    valueAt: (reference) =>
      ({ '/data/photos[1]/photo': 'image-a.jpg', '/data/photos[2]/photo': 'image-b.jpg' })[reference] ?? '',
    media: mediaRows,
    uriFor: (fileKey) => `file:///${fileKey}`,
  });

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.filename), ['image-a.jpg', 'image-b.jpg']);
  // Duck-typed for MediaGallery, and carrying what the adapter needs to act.
  assert.equal(items[0].uri, 'file:///projects/p/media/i/image-a.jpg');
  assert.equal(items[0].mimeType, 'image/jpeg');
  assert.equal(items[1].reference, '/data/photos[2]/photo');
  assert.equal(items[1].instanceReference, '/data/photos[2]');
  assert.equal(items[1].position, 2);
});

test('a half-written instance is not a collection item', () => {
  const items = collectionItemsFrom({
    instanceReferences: ['/data/photos[1]', '/data/photos[2]', '/data/photos[3]'],
    valueAt: (reference) =>
      ({
        '/data/photos[1]/photo': 'image-a.jpg',
        '/data/photos[2]/photo': '', // added but not yet captured
        '/data/photos[3]/photo': 'image-missing.jpg', // no media row
      })[reference] ?? '',
    media: mediaRows,
    uriFor: (fileKey) => `file:///${fileKey}`,
  });

  assert.deepEqual(items.map((item) => item.filename), ['image-a.jpg']);
});

test('orphans are computed from referenced filenames, never from positions', () => {
  // After removing the first of two, the survivor reindexes to [1] — so
  // positions are useless for identity and only filenames are trustworthy.
  const before = [{ filename: 'image-a.jpg' }, { filename: 'image-b.jpg' }];
  const after = [{ filename: 'image-b.jpg' }];

  assert.deepEqual(orphanedFilenames({ before, after }), ['image-a.jpg']);
  assert.deepEqual(orphanedFilenames({ before, after: before }), []);
  assert.deepEqual(orphanedFilenames({ before, after: [] }), ['image-a.jpg', 'image-b.jpg']);
});

test('orphan detection accepts plain filenames and ignores duplicates', () => {
  assert.deepEqual(
    orphanedFilenames({ before: ['a.jpg', 'a.jpg', 'b.jpg'], after: ['b.jpg'] }),
    ['a.jpg'],
  );
  assert.deepEqual(orphanedFilenames({}), []);
});
