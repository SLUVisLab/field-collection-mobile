import test from 'node:test';
import assert from 'node:assert/strict';

import {
  XFORMS_EVENT_TYPES,
  XFORMS_HOST_ERROR_CODES,
  XFormsHost,
  XFormsHostError,
  isXFormsEvent,
  isXFormsEventType,
} from '../src/index.js';

test('base XFormsHost methods throw consistent not-implemented errors', async () => {
  const host = new XFormsHost();
  await assert.rejects(host.initialize(), (error) => {
    assert.equal(error instanceof XFormsHostError, true);
    assert.equal(error.code, XFORMS_HOST_ERROR_CODES.NOT_IMPLEMENTED);
    assert.match(error.message, /initialize/);
    return true;
  });
  await assert.rejects(host.loadForm('<xml />'), /loadForm/);
  await assert.rejects(host.loadInstance('<xml />', '<data />'), /loadInstance/);
  await assert.rejects(host.getSnapshot(), /getSnapshot/);
  await assert.rejects(host.getRenderModel(), /getRenderModel/);
  await assert.rejects(host.setValue('/data/a', 1), /setValue/);
  await assert.rejects(host.addRepeat('/data/r'), /addRepeat/);
  await assert.rejects(host.removeRepeat('/data/r', '0'), /removeRepeat/);
  await assert.rejects(host.serialize(), /serialize/);
  await assert.rejects(host.inspectMediaSeam(), /inspectMediaSeam/);
  assert.throws(() => host.subscribe(() => {}), /subscribe/);
  await assert.rejects(host.dispose(), /dispose/);
});

test('loadInstance and getRenderModel report NOT_IMPLEMENTED on the base host', async () => {
  const host = new XFormsHost();
  for (const [invoke, name] of [
    [() => host.loadInstance('<xml />', '<data />'), 'loadInstance'],
    [() => host.getRenderModel(), 'getRenderModel'],
  ]) {
    await assert.rejects(invoke, (error) => {
      assert.equal(error instanceof XFormsHostError, true);
      assert.equal(error.code, XFORMS_HOST_ERROR_CODES.NOT_IMPLEMENTED);
      assert.equal(error.details.methodName, name);
      return true;
    });
  }
});

test('event helpers identify valid event shapes', () => {
  assert.equal(isXFormsEventType(XFORMS_EVENT_TYPES.STATE_CHANGED), true);
  assert.equal(isXFormsEventType('unknown'), false);

  assert.equal(
    isXFormsEvent({
      type: XFORMS_EVENT_TYPES.LOG,
      payload: { level: 'info' },
    }),
    true
  );

  assert.equal(
    isXFormsEvent({
      type: 'unknown',
      payload: {},
    }),
    false
  );

  assert.equal(isXFormsEvent(null), false);
});
