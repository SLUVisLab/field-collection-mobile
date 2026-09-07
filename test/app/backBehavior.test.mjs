import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveHardwareBack,
  makeHardwareBackHandler,
} from '../../src/navigation/backBehavior.js';

test('resolveHardwareBack exits on a shell root route', () => {
  assert.deepEqual(resolveHardwareBack({ pathname: '/setup' }), {
    consume: false,
    action: 'exit',
  });
  assert.deepEqual(resolveHardwareBack({ pathname: '/project' }), {
    consume: false,
    action: 'exit',
  });
});

test('resolveHardwareBack pops one level on a deeper route', () => {
  assert.deepEqual(resolveHardwareBack({ pathname: '/project/forms' }), {
    consume: true,
    action: 'back',
  });
  assert.deepEqual(resolveHardwareBack({ pathname: '/setup/scan' }), {
    consume: true,
    action: 'back',
  });
});

test('resolveHardwareBack tolerates a missing/blank location', () => {
  assert.equal(resolveHardwareBack(null).action, 'back');
  assert.equal(resolveHardwareBack({}).action, 'back');
});

test('makeHardwareBackHandler navigates back and consumes on deep routes', () => {
  const calls = [];
  const navigate = (delta) => calls.push(delta);
  const handler = makeHardwareBackHandler({ pathname: '/project/forms' }, navigate);
  const consumed = handler();
  assert.equal(consumed, true, 'consumes the event');
  assert.deepEqual(calls, [-1], 'pops one history entry');
});

test('makeHardwareBackHandler does not navigate and lets the app exit at root', () => {
  const calls = [];
  const navigate = (delta) => calls.push(delta);
  const handler = makeHardwareBackHandler({ pathname: '/project' }, navigate);
  const consumed = handler();
  assert.equal(consumed, false, 'does not consume — Android exits the app');
  assert.deepEqual(calls, [], 'no navigation performed');
});
