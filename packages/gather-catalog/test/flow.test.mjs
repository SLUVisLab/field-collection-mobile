import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveFlowView, SEGMENT_AND_MEASURE_INSTRUMENT, SEGMENT_AND_MEASURE_VIEWS } from '../src/index.js';

const flow = () =>
  SEGMENT_AND_MEASURE_INSTRUMENT.messages
    .find((message) => 'updateComponents' in message)
    .updateComponents.components.find((component) => component.component === 'Flow');

test('Flow renders the View selected externally, and nothing else', () => {
  const views = [
    { when: 'capture', view: 'captureView' },
    { when: 'review-mask', view: 'reviewView' },
  ];

  assert.equal(resolveFlowView({ current: 'capture', views }), 'captureView');
  assert.equal(resolveFlowView({ current: 'review-mask', views }), 'reviewView');
});

test('several tokens may resolve to one View', () => {
  const views = [
    { when: 'segmenting', view: 'processingView' },
    { when: 'measuring', view: 'processingView' },
  ];

  assert.equal(resolveFlowView({ current: 'segmenting', views }), 'processingView');
  assert.equal(resolveFlowView({ current: 'measuring', views }), 'processingView');
});

test('an unmatched value falls back, and renders nothing without a fallback', () => {
  const views = [{ when: 'capture', view: 'captureView' }];

  assert.equal(resolveFlowView({ current: 'nonsense', views, fallback: 'captureView' }), 'captureView');
  assert.equal(resolveFlowView({ current: 'nonsense', views }), null);
  assert.equal(resolveFlowView({ current: undefined, views }), null);
  assert.equal(resolveFlowView({}), null);
});

test('Flow is presentation only — selection depends on nothing but its inputs', () => {
  const views = [{ when: 'capture', view: 'captureView' }];
  // Same inputs, same answer: no internal state, no transition of its own.
  assert.equal(resolveFlowView({ current: 'capture', views }), resolveFlowView({ current: 'capture', views }));
});

test('every view token the controller can write has a Flow entry', () => {
  const authored = flow().views;
  for (const token of Object.values(SEGMENT_AND_MEASURE_VIEWS)) {
    assert.ok(
      authored.some((entry) => entry.when === token),
      `no Flow view for token '${token}'`,
    );
  }
  // Every authored entry uses the shared token vocabulary, so the table and the
  // controller cannot drift apart.
  const tokens = new Set(Object.values(SEGMENT_AND_MEASURE_VIEWS));
  for (const entry of authored) {
    assert.ok(tokens.has(entry.when), `Flow entry '${entry.when}' is not a known view token`);
  }
});
