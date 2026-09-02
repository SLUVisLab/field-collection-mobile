import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendItem,
  canCapture,
  canComplete,
  captureCountLabel,
  removeItemAt,
} from '../src/image-collection/multiImageModel.js';

// Cardinality lives with the Component because it affects interaction; the host
// owns the underlying rule. See docs/components-capabilities-ownership.md §12.

test('capture stays available until the collection is full', () => {
  assert.equal(canCapture({ items: [], maxItems: 2 }), true);
  assert.equal(canCapture({ items: [1], maxItems: 2 }), true);
  assert.equal(canCapture({ items: [1, 2], maxItems: 2 }), false);
  // Unbounded when no maximum is declared.
  assert.equal(canCapture({ items: [1, 2, 3] }), true);
  assert.equal(canCapture({ items: [1], maxItems: null }), true);
});

test('completion unlocks once the minimum is met', () => {
  assert.equal(canComplete({ items: [], minItems: 2 }), false);
  assert.equal(canComplete({ items: [1], minItems: 2 }), false);
  assert.equal(canComplete({ items: [1, 2], minItems: 2 }), true);
  assert.equal(canComplete({ items: [1, 2, 3], minItems: 2 }), true);
  // No minimum means an empty collection is already complete.
  assert.equal(canComplete({ items: [] }), true);
});

test('an exact-count field is expressible as min === max', () => {
  const exactlyFour = { minItems: 4, maxItems: 4 };
  const three = [1, 2, 3];
  assert.equal(canCapture({ items: three, ...exactlyFour }), true, 'still short, keep capturing');
  assert.equal(canComplete({ items: three, ...exactlyFour }), false, 'not done yet');
  const four = [1, 2, 3, 4];
  assert.equal(canCapture({ items: four, ...exactlyFour }), false, 'full');
  assert.equal(canComplete({ items: four, ...exactlyFour }), true, 'done');
});

test('removal is by index and returns the same array when nothing changes', () => {
  const items = ['a', 'b', 'c'];
  assert.deepEqual(removeItemAt(items, 1), ['a', 'c']);
  assert.deepEqual(removeItemAt(items, 0), ['b', 'c']);
  assert.equal(removeItemAt(items, 5), items, 'out of range is a no-op');
  assert.equal(removeItemAt(items, -1), items);
  assert.deepEqual(removeItemAt(null, 0), []);
  assert.deepEqual(items, ['a', 'b', 'c'], 'the input is never mutated');
});

test('append ignores a nullish item so a failed capture is a no-op', () => {
  assert.deepEqual(appendItem(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(appendItem(['a'], null), ['a']);
  assert.deepEqual(appendItem(['a'], undefined), ['a']);
  assert.deepEqual(appendItem(null, 'a'), ['a']);
});

test('the count accessory reads as progress when bounded, and stays quiet when idle', () => {
  assert.equal(captureCountLabel({ items: [1, 2], maxItems: 4 }), '2 of 4');
  assert.equal(captureCountLabel({ items: [1, 2], minItems: 4 }), '2 of 4', 'a minimum is progress too');
  assert.equal(captureCountLabel({ items: [1, 2, 3, 4], minItems: 2 }), '4');
  assert.equal(captureCountLabel({ items: [1, 2] }), '2');
  // Nothing captured and nothing required: no accessory at all.
  assert.equal(captureCountLabel({ items: [] }), null);
});
