import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compositionEntryFor,
  registerComposition,
  registeredCompositionIds,
  resetCompositionRegistry,
} from '../../src/a2ui/compositionRegistry.js';
import { QUADRAT_TALLY_DEFINITION } from '../fixtures/quadrat-tally/definition.mjs';
import { createQuadratTallyActionHandler } from '../fixtures/quadrat-tally/actionHandler.mjs';

test('the shipped build runs no compositions', () => {
  resetCompositionRegistry();
  assert.deepEqual(registeredCompositionIds(), []);
  // A form may legitimately declare one this build cannot run; the control
  // says so rather than rendering an empty group.
  assert.equal(compositionEntryFor(QUADRAT_TALLY_DEFINITION.id), null);
});

test('a harness registers what it drives, so it can use the real FormRunner path', () => {
  resetCompositionRegistry();
  registerComposition(QUADRAT_TALLY_DEFINITION.id, {
    definition: QUADRAT_TALLY_DEFINITION,
    createActionHandler: createQuadratTallyActionHandler({}),
  });

  const entry = compositionEntryFor(QUADRAT_TALLY_DEFINITION.id);
  assert.equal(entry.definition.id, QUADRAT_TALLY_DEFINITION.id);
  assert.equal(typeof entry.createActionHandler, 'function');
  assert.deepEqual(registeredCompositionIds(), [QUADRAT_TALLY_DEFINITION.id]);
  resetCompositionRegistry();
});

test('an entry without behaviour is refused — structure alone cannot run', () => {
  resetCompositionRegistry();
  assert.throws(
    () => registerComposition(QUADRAT_TALLY_DEFINITION.id, { definition: QUADRAT_TALLY_DEFINITION }),
    /needs a definition and a createActionHandler/
  );
  assert.throws(
    () => registerComposition(QUADRAT_TALLY_DEFINITION.id, { createActionHandler: () => {} }),
    /needs a definition and a createActionHandler/
  );
  assert.throws(() => registerComposition('', { definition: {}, createActionHandler: () => {} }), /non-empty id/);
  assert.deepEqual(registeredCompositionIds(), []);
});
