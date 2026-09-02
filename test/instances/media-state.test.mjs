import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeMedia, withoutMedia } from '../../src/instances/mediaState.js';

const row = (filename) => ({ filename, contentType: 'image/jpeg', fileKey: `k/${filename}` });

test('an attachment is appended in the order storage would return it', () => {
  // instances.listMedia is ORDER BY filename ASC, so the in-memory list has to
  // match what a reload produces.
  const next = mergeMedia([row('image-b.jpg')], row('image-a.jpg'));
  assert.deepEqual(next.map((entry) => entry.filename), ['image-a.jpg', 'image-b.jpg']);
});

test('re-upserting the same filename replaces in place rather than duplicating', () => {
  const next = mergeMedia([row('image-a.jpg'), row('image-b.jpg')], {
    ...row('image-a.jpg'),
    contentType: 'image/png',
  });
  assert.equal(next.length, 2);
  assert.equal(next.find((entry) => entry.filename === 'image-a.jpg').contentType, 'image/png');
});

test('a replacement capture retires the attachment it replaced', () => {
  // The single-image control passes previousFilename; the collection does not.
  const next = mergeMedia([row('image-old.jpg')], row('image-new.jpg'), 'image-old.jpg');
  assert.deepEqual(next.map((entry) => entry.filename), ['image-new.jpg']);
});

test('a capture with no replacement accumulates — the collection case', () => {
  let rows = [];
  for (const filename of ['image-a.jpg', 'image-b.jpg', 'image-c.jpg']) {
    rows = mergeMedia(rows, row(filename));
  }
  assert.deepEqual(rows.map((entry) => entry.filename), ['image-a.jpg', 'image-b.jpg', 'image-c.jpg']);
});

test('merging tolerates a missing or unusable attachment result', () => {
  assert.deepEqual(mergeMedia([row('image-a.jpg')], null).map((e) => e.filename), ['image-a.jpg']);
  assert.deepEqual(mergeMedia([row('image-a.jpg')], {}).map((e) => e.filename), ['image-a.jpg']);
  assert.deepEqual(mergeMedia(), []);
  // A retirement with no replacement still removes the retired row.
  assert.deepEqual(mergeMedia([row('image-a.jpg')], null, 'image-a.jpg'), []);
});

test('removal is by filename, never by position', () => {
  const rows = [row('image-a.jpg'), row('image-b.jpg'), row('image-c.jpg')];
  assert.deepEqual(
    withoutMedia(rows, ['image-b.jpg']).map((entry) => entry.filename),
    ['image-a.jpg', 'image-c.jpg']
  );
  assert.deepEqual(withoutMedia(rows, []).length, 3);
  assert.deepEqual(withoutMedia(), []);
});
