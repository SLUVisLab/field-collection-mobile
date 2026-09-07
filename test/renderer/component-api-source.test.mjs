import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as shared from '../../src/a2ui/mobile/componentApis.js';

/**
 * Gather's Component APIs have one definition.
 *
 * The renderer used to declare its own, and they drifted silently: its
 * CameraView lacked `capture` and its Flow lacked `fallback`, both properties
 * the canonical Tool authors. Nothing compared them, so the Composer preview
 * ran a different contract from the device for months.
 *
 * This asserts the renderer *imports* rather than redeclares. It is a source
 * check because that is the failure — a duplicate that agrees today and drifts
 * tomorrow would pass any behavioural test written now.
 */
const source = readFileSync(
  fileURLToPath(new URL('../../apps/renderer/src/gatherComponents.jsx', import.meta.url)),
  'utf8'
);

test('the renderer declares no Component API schemas of its own', () => {
  const declarations = [...source.matchAll(/const\s+(\w+Api)\s*=\s*\{\s*\n\s*name:/g)].map((m) => m[1]);
  assert.deepEqual(
    declarations,
    [],
    `apps/renderer redeclares ${declarations.join(', ')} — import them from ` +
      'src/a2ui/mobile/componentApis.js instead, so there is one contract.'
  );
});

test('it imports the shared APIs, and uses them for every Component', () => {
  assert.match(source, /from '\.\.\/\.\.\/\.\.\/src\/a2ui\/mobile\/componentApis\.js'/);
  const used = [...source.matchAll(/createComponentImplementation\((\w+),/g)].map((m) => m[1]);
  assert.ok(used.length >= 9, `expected every Gather Component to be bound, saw ${used.length}`);
  const sharedNames = new Set(
    Object.values(shared).filter((api) => api?.name && api?.schema).map((api) => api.name)
  );
  for (const identifier of used) {
    const api = shared[identifier];
    assert.ok(api?.schema, `${identifier} is not a shared Component API`);
    assert.ok(sharedNames.has(api.name));
  }
});

test('the properties the canonical Tool authors are in the shared contract', () => {
  // The two that drifted, named so a regression is legible rather than generic.
  const keys = (api) => Object.keys(api.schema._def.shape());
  assert.ok(keys(shared.cameraViewApi).includes('capture'),
    'CameraView must accept `capture` — it is how a handler-free composition receives one');
  assert.ok(keys(shared.flowApi).includes('fallback'),
    'Flow must accept `fallback` — without it a Flow with no matching view renders nothing');
});
