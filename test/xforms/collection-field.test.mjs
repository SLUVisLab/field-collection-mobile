import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MULTI_IMAGE_APPEARANCE,
  binaryChildrenOf,
  collectionItemsFrom,
  instancePositionOf,
  multiImageConfigFrom,
  newestBinaryChild,
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

const childOf = (childName) => (instanceReference) => `${instanceReference}/${childName}`;

test('the repeat projects into an ImageAsset-shaped value view', () => {
  const items = collectionItemsFrom({
    instanceReferences: ['/data/photos[1]', '/data/photos[2]'],
    binaryChildOf: childOf('photo'),
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

test('the image child is whatever the form author named it', () => {
  // The regression: this projected an empty collection for every form whose
  // image child was not literally named `photo`, so captures persisted into the
  // XML and then vanished from the UI.
  const items = collectionItemsFrom({
    instanceReferences: ['/data/frames[1]'],
    binaryChildOf: childOf('frame'),
    valueAt: (reference) => (reference === '/data/frames[1]/frame' ? 'image-a.jpg' : ''),
    media: mediaRows,
    uriFor: (fileKey) => `file:///${fileKey}`,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].reference, '/data/frames[1]/frame');
  assert.equal(items[0].filename, 'image-a.jpg');
});

test('an unresolvable image child is skipped, not guessed at', () => {
  const items = collectionItemsFrom({
    instanceReferences: ['/data/photos[1]', '/data/photos[2]'],
    binaryChildOf: (instanceReference) =>
      instanceReference === '/data/photos[1]' ? '/data/photos[1]/photo' : null,
    valueAt: () => 'image-a.jpg',
    media: mediaRows,
    uriFor: (fileKey) => `file:///${fileKey}`,
  });

  assert.deepEqual(items.map((item) => item.instanceReference), ['/data/photos[1]']);
});

test('projecting without a resolver fails loudly rather than silently empty', () => {
  // A silent [] is exactly how the hardcoded-`photo` defect hid.
  assert.throws(
    () => collectionItemsFrom({ instanceReferences: ['/data/photos[1]'], valueAt: () => 'a.jpg' }),
    /requires binaryChildOf/
  );
});

test('the binary child is read from the engine, per instance', () => {
  const byInstance = binaryChildrenOf({
    repeatReference: '/data/frames',
    nodesByReference: {
      '/data/note': { valueType: 'string' },
      '/data/frames[1]': { valueType: null },
      '/data/frames[1]/frame': { valueType: 'binary' },
      '/data/frames[1]/caption': { valueType: 'string' },
      '/data/frames[2]/frame': { valueType: 'binary' },
      // A different repeat's binary child must not leak in.
      '/data/others[1]/photo': { valueType: 'binary' },
    },
  });

  assert.deepEqual([...byInstance.entries()], [
    ['/data/frames[1]', '/data/frames[1]/frame'],
    ['/data/frames[2]', '/data/frames[2]/frame'],
  ]);
});

test('resolving the binary child tolerates an empty or unusable model', () => {
  assert.equal(binaryChildrenOf().size, 0);
  assert.equal(binaryChildrenOf({ repeatReference: '/data/frames' }).size, 0);
  // The non-positional template node is not an instance.
  assert.equal(
    binaryChildrenOf({
      repeatReference: '/data/frames',
      nodesByReference: { '/data/frames/frame': { valueType: 'binary' } },
    }).size,
    0
  );
});

test('the newest slot is the highest position, not the last key seen', () => {
  const byInstance = new Map([
    ['/data/frames[1]', '/data/frames[1]/frame'],
    ['/data/frames[10]', '/data/frames[10]/frame'],
    ['/data/frames[2]', '/data/frames[2]/frame'],
  ]);

  assert.equal(newestBinaryChild(byInstance), '/data/frames[10]/frame');
  assert.equal(newestBinaryChild(new Map()), null);
  assert.equal(newestBinaryChild(), null);
});

test('a half-written instance is not a collection item', () => {
  const items = collectionItemsFrom({
    instanceReferences: ['/data/photos[1]', '/data/photos[2]', '/data/photos[3]'],
    binaryChildOf: childOf('photo'),
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
