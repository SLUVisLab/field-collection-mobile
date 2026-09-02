import assert from 'node:assert/strict';
import test from 'node:test';

import { GATHER_ACTION_IDS } from '../../packages/gather-catalog/src/index.js';
// The render-free API descriptors, not the JSX catalogs — same import the
// existing runtime test uses.
import { gatherComponentApis, mobileBasicApis } from '../../src/a2ui/mobile/componentApis.js';
import { createA2uiRuntime } from '../../src/a2ui/a2uiRuntime.js';

import {
  QUADRAT_TALLY_ACTIONS,
  QUADRAT_TALLY_DEFINITION,
  QUADRAT_TALLY_MANIFEST,
} from '../fixtures/quadrat-tally/definition.mjs';
import { createQuadratTallyActionHandler } from '../fixtures/quadrat-tally/actionHandler.mjs';

import { parseBindingManifest, resolveCompositionFields } from '../../src/xforms/compositionField.js';
import { commitCompositionResult } from '../../src/xforms/compositionCommit.js';

/**
 * The composition→ODK path, end to end through the real A2UI runtime:
 * authored composition → typed result → binding manifest → XForms values →
 * provenance. No device, no model, no camera.
 */

const harness = () => {
  const accepted = [];
  const runtime = createA2uiRuntime({
    tool: QUADRAT_TALLY_DEFINITION,
    componentApis: [...mobileBasicApis, ...gatherComponentApis],
  });
  runtime.setActionHandler(
    createQuadratTallyActionHandler({ now: () => '2026-09-02T00:00:00.000Z' })({
      processor: runtime.processor,
      onAcceptedResult: async (result, context) => { accepted.push({ result, context }); },
    })
  );
  return {
    accepted,
    state: () => runtime.state(QUADRAT_TALLY_DEFINITION.statePath),
    dispatch: (name, context) =>
      runtime.surface.dispatchAction({ event: { name, ...(context ? { context } : {}) } }, name),
  };
};

const makeForm = () => {
  const writes = [];
  return { writes, setValue: async (reference, value) => writes.push([reference, value]) };
};

const makeReceipts = () => {
  const rows = new Map();
  return {
    rows,
    upsertReceipt: async ({ bindingReference, receipt }) => rows.set(bindingReference, receipt),
    deleteReceipt: async ({ bindingReference }) => rows.delete(bindingReference),
  };
};

const resolvedField = () => {
  const { fields, problems } = resolveCompositionFields({
    renderModel: {
      nodes: [
        {
          reference: '/data/quadrat',
          nodeType: 'group',
          appearances: [`gather-composition:${QUADRAT_TALLY_DEFINITION.id}`],
        },
      ],
    },
    manifest: parseBindingManifest(QUADRAT_TALLY_MANIFEST),
  });
  assert.deepEqual(problems, [], 'the fixture form and its manifest agree');
  return fields[0];
};

test('the composition starts on its single View with an empty tally', () => {
  const { state } = harness();
  assert.equal(state().count, 0);
  assert.equal(state().uncertain, false);
});

test('the tally counts up and down, and never below zero', async () => {
  const { dispatch, state } = harness();
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  assert.equal(state().count, 3);

  await dispatch(QUADRAT_TALLY_ACTIONS.decrement);
  assert.equal(state().count, 2);

  for (let index = 0; index < 5; index += 1) {
    await dispatch(QUADRAT_TALLY_ACTIONS.decrement);
  }
  // Refusing to go negative is better than producing a value no int field
  // should hold.
  assert.equal(state().count, 0);
});

test('Accept delivers scalar outputs and an execution receipt', async () => {
  const { dispatch, accepted } = harness();
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  await dispatch(GATHER_ACTION_IDS.accept);

  assert.equal(accepted.length, 1);
  assert.deepEqual(accepted[0].result, { count: 2 }, 'no note unless flagged');
  const { receipt } = accepted[0].context;
  assert.equal(receipt.capability, QUADRAT_TALLY_DEFINITION.id);
  assert.equal(receipt.capabilityRevision, '0.1.0');
  assert.ok(receipt.revision, 'the receipt carries its own digest');
  assert.deepEqual(receipt.outputs, { count: 2 });
});

test('flagging the tally adds the optional output', async () => {
  const { dispatch, accepted } = harness();
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  await dispatch(QUADRAT_TALLY_ACTIONS.toggleUncertain);
  await dispatch(GATHER_ACTION_IDS.accept);
  assert.deepEqual(accepted[0].result, { count: 1, note: 'uncertain' });
});

test('the composition declares outputs by name and never an XPath', () => {
  // §1: the artifact must stay reusable across forms.
  const serialized = JSON.stringify(QUADRAT_TALLY_DEFINITION);
  assert.equal(serialized.includes('/data/'), false, 'no XForms path leaks into the composition');
  assert.deepEqual(
    QUADRAT_TALLY_DEFINITION.result.outputs.map((output) => output.path),
    ['count', 'note']
  );
});

test('an accepted result commits through the manifest into XForms values', async () => {
  const { dispatch, accepted } = harness();
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  await dispatch(QUADRAT_TALLY_ACTIONS.toggleUncertain);
  await dispatch(GATHER_ACTION_IDS.accept);

  const form = makeForm();
  const receipts = makeReceipts();
  const outcome = await commitCompositionResult({
    result: accepted[0].result,
    field: resolvedField(),
    form,
    receipts,
    receipt: accepted[0].context.receipt,
    localInstanceId: 'i-1',
  });

  assert.deepEqual(form.writes, [
    ['/data/quadrat/count', '2'],
    ['/data/quadrat/note', 'uncertain'],
  ]);
  assert.deepEqual(outcome.recorded, ['/data/quadrat/count', '/data/quadrat/note']);
  // Both projected fields can now answer "was this produced by a composition?"
  assert.equal(receipts.rows.get('/data/quadrat/count').capability, QUADRAT_TALLY_DEFINITION.id);
});

test('an unflagged tally clears the optional field and its provenance', async () => {
  const form = makeForm();
  const receipts = makeReceipts();
  // A previous run had flagged it, so stale provenance exists.
  receipts.rows.set('/data/quadrat/note', { capability: 'stale' });

  const { dispatch, accepted } = harness();
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  await dispatch(GATHER_ACTION_IDS.accept);

  const outcome = await commitCompositionResult({
    result: accepted[0].result,
    field: resolvedField(),
    form,
    receipts,
    receipt: accepted[0].context.receipt,
    localInstanceId: 'i-1',
  });

  assert.deepEqual(form.writes, [
    ['/data/quadrat/count', '1'],
    ['/data/quadrat/note', ''],
  ]);
  assert.deepEqual(outcome.cleared, ['/data/quadrat/note']);
  assert.equal(receipts.rows.has('/data/quadrat/note'), false, 'stale provenance goes with the value');
});

test('a required output the composition cannot produce fails Accept, writing nothing', async () => {
  // The composition always produces `count`, so this drives the guard directly
  // with a result the manifest declares required and the result omits.
  const form = makeForm();
  await assert.rejects(
    () => commitCompositionResult({ result: { note: 'uncertain' }, field: resolvedField(), form }),
    /did not produce a required value/
  );
  assert.deepEqual(form.writes, []);
});

test('the runtime absorbs a handler throw — so a composition must surface its own errors', async () => {
  // Characterization, not a preference: the upstream surface swallows whatever
  // the action handler throws, so `dispatchAction` resolves and the caller
  // learns nothing. That is why the Photo Capture fixture writes its failures
  // into the data model and renders an error View rather than relying on the
  // throw propagating. This fixture has one View and no error path, so an
  // unhandled action is simply inert.
  const { dispatch, state } = harness();
  await dispatch(QUADRAT_TALLY_ACTIONS.increment);
  const before = state().count;

  await dispatch('fixture.quadratTally.nope');

  assert.equal(state().count, before, 'state is untouched by the unhandled action');
});
