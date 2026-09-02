import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mediaItemKey,
  mediaKind,
  mediaPosterUri,
  moveItem,
  normalizeMediaItems,
  selectionKeySet,
} from '../src/components/media/mediaModel.js';

test('mediaItemKey prefers durable ids, falls back to location then index', () => {
  assert.equal(mediaItemKey({ assetId: 'a1', uri: 'x' }, 0), 'a1');
  assert.equal(mediaItemKey({ id: 'i2', uri: 'x' }, 0), 'i2');
  assert.equal(mediaItemKey({ uri: 'file://p.jpg' }, 0), 'file://p.jpg');
  assert.equal(mediaItemKey({ path: 'media/p.jpg' }, 0), 'media/p.jpg');
  assert.equal(mediaItemKey({}, 4), '4');
  assert.equal(mediaItemKey('bare-key'), 'bare-key');
  assert.equal(mediaItemKey(null, 2), '2');
});

test('normalizeMediaItems preserves order/index and duck-types uri + dims', () => {
  const entries = normalizeMediaItems([
    { assetId: 'a', uri: 'u-a', width: 10, height: 20 },
    { assetId: 'b' },
    'not-an-object',
  ]);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map((e) => e.index), [0, 1, 2]);
  assert.deepEqual(entries.map((e) => e.key), ['a', 'b', 'not-an-object']);
  assert.deepEqual(entries.map((e) => e.uri), ['u-a', null, null]);
  assert.deepEqual(entries[0], { item: entries[0].item, index: 0, key: 'a', uri: 'u-a', width: 10, height: 20 });
  assert.equal(entries[1].width, null);
});

test('normalizeMediaItems tolerates non-array input', () => {
  assert.deepEqual(normalizeMediaItems(null), []);
  assert.deepEqual(normalizeMediaItems(undefined), []);
  assert.deepEqual(normalizeMediaItems('x'), []);
});

test('selectionKeySet accepts single, multiple, item objects, and bare keys', () => {
  const single = selectionKeySet({ selectedItem: { assetId: 'a' } });
  assert.ok(single.has('a'));

  const multi = selectionKeySet({ selectedItems: [{ assetId: 'a' }, 'b', null] });
  assert.ok(multi.has('a'));
  assert.ok(multi.has('b'));
  assert.equal(multi.size, 2);

  const both = selectionKeySet({ selectedItem: { assetId: 'c' }, selectedItems: [{ assetId: 'a' }] });
  assert.deepEqual([...both].sort(), ['a', 'c']);

  assert.equal(selectionKeySet().size, 0);
});

test('moveItem returns a new reordered array without mutating input', () => {
  const list = ['a', 'b', 'c', 'd'];
  const moved = moveItem(list, 0, 2);
  assert.deepEqual(moved, ['b', 'c', 'a', 'd']);
  assert.deepEqual(list, ['a', 'b', 'c', 'd']);

  const back = moveItem(list, 3, 1);
  assert.deepEqual(back, ['a', 'd', 'b', 'c']);
});

test('moveItem returns the original reference for no-op / out-of-range moves', () => {
  const list = ['a', 'b'];
  assert.equal(moveItem(list, 1, 1), list);
  assert.equal(moveItem(list, -1, 0), list);
  assert.equal(moveItem(list, 0, 5), list);
  assert.deepEqual(moveItem(null, 0, 1), []);
});

test('mediaKind classifies by declared type, mime, duration, then extension', () => {
  assert.equal(mediaKind({ mediaType: 'video' }), 'video');
  assert.equal(mediaKind({ type: 'image' }), 'photo');
  assert.equal(mediaKind({ mimeType: 'video/mp4' }), 'video');
  assert.equal(mediaKind({ contentType: 'image/jpeg' }), 'photo');
  assert.equal(mediaKind({ durationMs: 4200 }), 'video');
  assert.equal(mediaKind({ uri: 'file://clip.MOV' }), 'video');
  assert.equal(mediaKind({ path: 'media/still.jpg' }), 'photo');
  assert.equal(mediaKind({ uri: 'file://unknown' }), 'photo');
  assert.equal(mediaKind(null), 'photo');
});

test('mediaPosterUri prefers explicit poster, uses uri only for photos', () => {
  assert.equal(mediaPosterUri({ posterUri: 'p1', mediaType: 'video' }), 'p1');
  assert.equal(mediaPosterUri({ thumbnailUri: 'p2' }), 'p2');
  assert.equal(mediaPosterUri({ uri: 'u', mimeType: 'image/png' }), 'u');
  assert.equal(mediaPosterUri({ uri: 'u', mimeType: 'video/mp4' }), null);
  assert.equal(mediaPosterUri(null), null);
});
