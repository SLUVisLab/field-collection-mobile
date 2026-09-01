import assert from 'node:assert/strict';
import test from 'node:test';

import { createToolFlowController } from '../../src/a2ui/toolFlowController.js';

test('a controller starts at its initial view and reports every change', () => {
  const changes = [];
  const controller = createToolFlowController({
    initialView: 'capture',
    onViewChange: (view, previous) => changes.push([previous, view]),
  });

  assert.equal(controller.activeView, 'capture');
  controller.setView('review');
  assert.equal(controller.activeView, 'review');
  controller.setView('summary');
  assert.deepEqual(changes, [['capture', 'review'], ['review', 'summary']]);
});

test('a controller resumes from durable state but resets to the initial view', () => {
  const controller = createToolFlowController({ initialView: 'capture', startView: 'summary' });

  assert.equal(controller.activeView, 'summary', 'seeded from durable state');
  controller.reset();
  assert.equal(controller.activeView, 'capture', 'reset targets the initial view, not the seed');
});

test('dispatch routes an event to its handler with the controller', async () => {
  const seen = [];
  const controller = createToolFlowController({
    initialView: 'capture',
    handlers: {
      'tool.go': async (payload, flow) => {
        seen.push(payload);
        flow.setView('review');
        return 'done';
      },
    },
  });

  const result = await controller.dispatch('tool.go', { id: 7 });

  assert.equal(result, 'done');
  assert.deepEqual(seen, [{ id: 7 }]);
  assert.equal(controller.activeView, 'review');
});

test('unknown events are inert, so a surface may declare unimplemented actions', async () => {
  const controller = createToolFlowController({ initialView: 'capture', handlers: {} });

  assert.equal(await controller.dispatch('tool.unknown', {}), undefined);
  assert.equal(controller.activeView, 'capture');
});

test('a controller requires an initial view and rejects empty view names', () => {
  assert.throws(() => createToolFlowController({}), /requires an initial view/);
  const controller = createToolFlowController({ initialView: 'capture' });
  assert.throws(() => controller.setView(''), /non-empty string/);
  assert.throws(() => controller.setView(null), /non-empty string/);
});

// The seam is deliberately not a statechart: no guards, nested states,
// entry/exit actions, timers, or parallel states. Transition policy lives in
// the bespoke handlers so a generic driver can replace them later.
test('the controller exposes only the small orchestration surface', () => {
  const controller = createToolFlowController({ initialView: 'capture' });
  assert.deepEqual(
    Object.keys(controller).sort(),
    ['activeView', 'dispatch', 'reset', 'setView'],
  );
});
