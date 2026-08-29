import test from 'node:test';
import assert from 'node:assert/strict';

import { area, color, measureImage, measureMask } from '../../src/capabilities/measure/index.js';

const image = { path: 'images/source.jpg' };
const mask = { path: 'masks/result.png', width: 2, height: 2 };

test('measurement capabilities remain adapter-backed and asset-only', async () => {
  const adapter = {
    maskMeasurements: async () => ({ area: { value: 4, unit: 'px2' } }),
    imageMeasurements: async () => ({
      color: { colorSpace: 'sRGB', statistic: 'mean', channels: { red: 1, green: 2, blue: 3 } },
      sharpness: { metric: 'variance-of-laplacian', score: 3 },
    }),
  };
  assert.deepEqual(await measureMask({ mask, adapter }), { area: { value: 4, unit: 'px2' } });
  assert.deepEqual(await measureImage({ image, mask, adapter }), {
    color: { colorSpace: 'sRGB', statistic: 'mean', channels: { red: 1, green: 2, blue: 3 } },
    sharpness: { metric: 'variance-of-laplacian', score: 3 },
  });
  assert.deepEqual(await area({ mask, adapter }), { value: 4, unit: 'px2' });
  assert.deepEqual(await color({ image, mask, adapter }), {
    colorSpace: 'sRGB', statistic: 'mean', channels: { red: 1, green: 2, blue: 3 },
  });
});
