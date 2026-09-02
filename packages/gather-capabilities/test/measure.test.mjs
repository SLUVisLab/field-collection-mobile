import assert from 'node:assert/strict';
import test from 'node:test';

import { area, perimeter, color, sharpness, measureMask, measureImage } from '../src/measure/implementation.js';

const mask = { path: 'm.png', width: 10, height: 10 };
const image = { path: 'img.jpg' };

const adapter = {
  maskMeasurements: (m) => {
    assert.equal(m, mask);
    return { area: { value: 100, unit: 'px2' }, perimeter: { value: 40, unit: 'px' } };
  },
  imageMeasurements: (img, m) => {
    assert.equal(img, image);
    assert.equal(m, mask);
    return { color: { mean: { r: 1, g: 2, b: 3 } }, sharpness: { score: 12.5 } };
  },
};

test('measure.* facets read the injected adapter', async () => {
  assert.deepEqual(await area({ mask, adapter }), { value: 100, unit: 'px2' });
  assert.deepEqual(await perimeter({ mask, adapter }), { value: 40, unit: 'px' });
  assert.deepEqual(await color({ image, mask, adapter }), { mean: { r: 1, g: 2, b: 3 } });
  assert.deepEqual(await sharpness({ image, mask, adapter }), { score: 12.5 });
});

// Ported from the retired app-side measure test: the grouped accessors are the
// adapter's own shape, asserted directly rather than only through the facets.
test('measureMask and measureImage return the adapter groups unchanged', async () => {
  assert.deepEqual(await measureMask({ mask, adapter }), {
    area: { value: 100, unit: 'px2' },
    perimeter: { value: 40, unit: 'px' },
  });
  assert.deepEqual(await measureImage({ image, mask, adapter }), {
    color: { mean: { r: 1, g: 2, b: 3 } },
    sharpness: { score: 12.5 },
  });
});

test('measure enforces mask/image/adapter contracts', async () => {
  await assert.rejects(() => measureMask({ mask: { path: 'm' }, adapter }), /MaskAsset/);
  await assert.rejects(() => area({ mask, adapter: {} }), /runtime is unavailable/);
  await assert.rejects(() => color({ image: {}, mask, adapter }), /ImageAsset/);
});
