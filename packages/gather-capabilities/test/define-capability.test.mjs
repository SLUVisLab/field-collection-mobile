import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';

import { defineCapability } from '../src/defineCapability.js';

test('defineCapability requires a domain.operation id', () => {
  assert.throws(() => defineCapability({ id: 'segment', title: 't', description: 'd' }), /domain\.operation/);
  assert.throws(() => defineCapability({ id: 'image.', title: 't', description: 'd' }), /domain\.operation/);
  assert.doesNotThrow(() => defineCapability({ id: 'image.segment', title: 't', description: 'd' }));
});

test('defineCapability requires title and description', () => {
  assert.throws(() => defineCapability({ id: 'image.segment' }), /title and description/);
});

test('defineCapability defaults version, platforms, and freezes the definition', () => {
  const def = defineCapability({ id: 'image.segment', title: 'Segment', description: 'd' });
  assert.equal(def.version, 1);
  assert.deepEqual(def.platforms, ['android', 'ios', 'web']);
  assert.ok(Object.isFrozen(def));
});

test('describe() is a plain metadata descriptor with no functions or schemas', () => {
  const def = defineCapability({
    id: 'image.segment',
    title: 'Segment',
    description: 'd',
    group: 'Image',
    kind: 'inference',
    input: z.object({ x: z.number() }),
  });
  const described = def.describe();
  assert.equal(described.id, 'image.segment');
  assert.equal(described.group, 'Image');
  assert.equal(described.kind, 'inference');
  for (const value of Object.values(described)) {
    assert.notEqual(typeof value, 'function');
  }
  assert.ok(!('input' in described), 'describe() must not leak the zod schema');
});
