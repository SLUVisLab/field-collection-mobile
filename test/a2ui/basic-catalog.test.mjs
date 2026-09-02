import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageApi } from '@a2ui/web_core/v0_9/basic_catalog';

import { aspectRatioFromLoad, resizeModeForFit } from '../../src/a2ui/mobile/basicCatalogModel.js';

// `Image`/`Video` are upstream A2UI vocabulary, not Gather Components: the mobile
// renderer must implement them, and the web renderer gets them from @a2ui/react.
// See docs/components-capabilities-ownership.md §10.

// `fit` is declared as enum().default().optional(), so unwrap the zod wrappers
// rather than assuming a fixed nesting depth.
const unwrap = (schema, typeName) => {
  let node = schema;
  while (node?._def && node._def.typeName !== typeName) node = node._def.innerType;
  return node?._def ?? null;
};

test('the mobile renderer covers every fit value the Basic Catalog can send', () => {
  const declared = unwrap(ImageApi.schema.shape.fit, 'ZodEnum').values;
  assert.deepEqual(declared, ['contain', 'cover', 'fill', 'none', 'scaleDown']);

  const supported = new Set(['contain', 'cover', 'stretch', 'center', 'repeat']);
  for (const fit of declared) {
    assert.ok(
      supported.has(resizeModeForFit(fit)),
      `fit '${fit}' maps to an unsupported React Native resizeMode`,
    );
  }
});

test('fit maps onto the React Native resizeMode with the documented approximation', () => {
  assert.equal(resizeModeForFit('contain'), 'contain');
  assert.equal(resizeModeForFit('cover'), 'cover');
  assert.equal(resizeModeForFit('fill'), 'stretch');
  assert.equal(resizeModeForFit('none'), 'center');
  // React Native has no scale-down; contain is the closest available mode.
  assert.equal(resizeModeForFit('scaleDown'), 'contain');
});

test('an absent or unknown fit falls back to the upstream default', () => {
  // ImageApi declares `fill` as the default, so the fallback must match it.
  assert.equal(unwrap(ImageApi.schema.shape.fit, 'ZodDefault').defaultValue(), 'fill');
  assert.equal(resizeModeForFit(undefined), 'stretch');
  assert.equal(resizeModeForFit('nonsense'), 'stretch');
});

test('aspect ratio is derived only from usable load dimensions', () => {
  assert.equal(aspectRatioFromLoad({ nativeEvent: { source: { width: 960, height: 640 } } }), 1.5);
  assert.equal(aspectRatioFromLoad({ nativeEvent: { source: { width: 0, height: 640 } } }), null);
  assert.equal(aspectRatioFromLoad({ nativeEvent: { source: { width: 960, height: 0 } } }), null);
  assert.equal(aspectRatioFromLoad({ nativeEvent: { source: { width: NaN, height: 1 } } }), null);
  assert.equal(aspectRatioFromLoad({ nativeEvent: { source: {} } }), null);
  assert.equal(aspectRatioFromLoad({}), null);
  assert.equal(aspectRatioFromLoad(undefined), null);
});
