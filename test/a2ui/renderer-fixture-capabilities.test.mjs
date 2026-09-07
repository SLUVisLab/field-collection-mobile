import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { fixtureCapabilities } from '../../apps/renderer/src/fixtureCapabilities.js';

/**
 * The renderer's fixture capabilities must implement everything
 * `capabilityActionAdapter` calls.
 *
 * The fixture is the only capability provider in the web renderer, and nothing
 * else exercises it: unit tests inject their own doubles, and the renderer
 * builds whether or not the names line up, because the calls are dynamic
 * property lookups resolved at press time. So a rename in the adapter left the
 * fixture calling `persistScientificCapture` for months, and every action in
 * the hosted renderer would have failed on `undefined is not a function`.
 *
 * The required names are **extracted from the adapter source** rather than
 * restated here. A list maintained by hand is the same failure one level up.
 */

const adapterSource = readFileSync(
  fileURLToPath(new URL('../../src/a2ui/capabilityActionAdapter.js', import.meta.url)),
  'utf8'
);

const requiredNames = [...adapterSource.matchAll(/\bcapabilities\??\.(\w+)/g)]
  .map((match) => match[1])
  .filter((name, index, all) => all.indexOf(name) === index)
  .sort();

test('the extraction finds the adapter capability calls', () => {
  // Guards the regex itself: a refactor that renamed the local `capabilities`
  // binding would otherwise make this whole file assert nothing at all.
  assert.ok(
    requiredNames.length >= 5,
    `expected the adapter to call several capabilities, found ${requiredNames.join(', ') || 'none'}`
  );
  assert.ok(requiredNames.includes('runImageSegmentation'));
});

test('the renderer fixture implements every capability the adapter calls', () => {
  const missing = requiredNames.filter((name) => typeof fixtureCapabilities[name] !== 'function');
  assert.deepEqual(
    missing,
    [],
    `apps/renderer/src/fixtureCapabilities.js is missing: ${missing.join(', ')}`
  );
});
