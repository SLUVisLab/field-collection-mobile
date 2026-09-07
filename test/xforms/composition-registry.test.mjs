import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compositionHandlerFor,
  registerCompositionHandler,
  registeredHandlerIds,
  resetCompositionHandlers,
} from '../../src/xforms/compositions/handlers/registry.js';
import { QUADRAT_TALLY_DEFINITION } from '../fixtures/quadrat-tally/definition.mjs';
import { createQuadratTallyActionHandler } from '../fixtures/quadrat-tally/actionHandler.mjs';

test('the shipped build ships no composition behaviour', () => {
  resetCompositionHandlers();
  assert.deepEqual(registeredHandlerIds(), []);
  // A form may declare a composition with no app-shipped handler; that is a
  // completely valid handler-free composition, not an unavailable one.
  assert.equal(compositionHandlerFor(QUADRAT_TALLY_DEFINITION.id), null);
});

test('a handler registers behaviour only — never a definition', () => {
  resetCompositionHandlers();
  registerCompositionHandler(QUADRAT_TALLY_DEFINITION.id, {
    createActionHandler: createQuadratTallyActionHandler({}),
  });

  const entry = compositionHandlerFor(QUADRAT_TALLY_DEFINITION.id);
  assert.equal(typeof entry.createActionHandler, 'function');
  // Definitions are supplied by forms; letting the registry carry one would
  // make Composer portability silently depend on app registration.
  assert.throws(
    () =>
      registerCompositionHandler('with_definition', {
        definition: QUADRAT_TALLY_DEFINITION,
        createActionHandler: () => async () => {},
      }),
    /must not carry a definition/
  );
  assert.deepEqual(registeredHandlerIds(), [QUADRAT_TALLY_DEFINITION.id]);
  resetCompositionHandlers();
});

test('an entry without behaviour is refused', () => {
  resetCompositionHandlers();
  assert.throws(
    () => registerCompositionHandler(QUADRAT_TALLY_DEFINITION.id, {}),
    /needs a createActionHandler/
  );
  assert.throws(() => registerCompositionHandler('', { createActionHandler: () => {} }), /non-empty id/);
  assert.deepEqual(registeredHandlerIds(), []);
});
