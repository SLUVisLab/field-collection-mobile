import assert from 'node:assert/strict';
import test from 'node:test';

import { GATHER_ACTION_IDS } from '../../packages/gather-catalog/src/index.js';
import { createMediaCollectionHandlers } from '../../src/a2ui/mediaCollectionActions.js';

/**
 * The collection handlers ship with `MultiImageCapture` / `MediaGallery`, so
 * their semantics are fixed rather than reinvented per composition.
 */

const surfaceWith = (state) => {
  const store = new Map([['/gather', state]]);
  return {
    dataModel: {
      get: (path) => store.get(path),
      set: (path, value) => store.set(path, value),
    },
  };
};

const asset = (id) => ({ assetId: id, uri: `file:///${id}.jpg`, path: `${id}.jpg`, width: 4, height: 3 });

test('a capture is persisted by the host and appended to the collection', async () => {
  const persisted = [];
  const handlers = createMediaCollectionHandlers({
    persistCapture: async (capture) => { persisted.push(capture); return asset('one'); },
  });
  const surface = surfaceWith({ items: [] });

  const next = await handlers[GATHER_ACTION_IDS.mediaCaptured]({
    surface,
    statePath: '/gather',
    context: { capture: { path: '/tmp/a.jpg' } },
  });

  // The Component handed over a plain descriptor; the host made it durable.
  assert.deepEqual(persisted, [{ path: '/tmp/a.jpg' }]);
  assert.deepEqual(next, [asset('one')]);
  assert.deepEqual(surface.dataModel.get('/gather').items, [asset('one')]);
});

test('captures append rather than replace, preserving order', async () => {
  let n = 0;
  const handlers = createMediaCollectionHandlers({
    persistCapture: async () => asset(`a${(n += 1)}`),
  });
  const surface = surfaceWith({ items: [] });
  const capture = { surface, statePath: '/gather', context: { capture: { path: '/tmp/x.jpg' } } };

  await handlers[GATHER_ACTION_IDS.mediaCaptured](capture);
  await handlers[GATHER_ACTION_IDS.mediaCaptured](capture);
  const items = surface.dataModel.get('/gather').items;

  assert.deepEqual(items.map((item) => item.assetId), ['a1', 'a2']);
});

test('removal carries an index, so a stale client list cannot clobber newer state', async () => {
  const handlers = createMediaCollectionHandlers({ persistCapture: async () => asset('x') });
  const surface = surfaceWith({ items: [asset('a'), asset('b'), asset('c')] });

  const next = await handlers[GATHER_ACTION_IDS.mediaChanged]({
    surface,
    statePath: '/gather',
    context: { change: 'remove', index: 1 },
  });

  assert.deepEqual(next.map((item) => item.assetId), ['a', 'c']);
});

test('an out-of-range removal is inert', async () => {
  const handlers = createMediaCollectionHandlers({ persistCapture: async () => asset('x') });
  const surface = surfaceWith({ items: [asset('a')] });

  const next = await handlers[GATHER_ACTION_IDS.mediaChanged]({
    surface, statePath: '/gather', context: { change: 'remove', index: 4 },
  });

  assert.deepEqual(next.map((item) => item.assetId), ['a']);
});

test('reorder and set apply the array the Component already computed', async () => {
  const handlers = createMediaCollectionHandlers({ persistCapture: async () => asset('x') });
  const surface = surfaceWith({ items: [asset('a'), asset('b')] });

  await handlers[GATHER_ACTION_IDS.mediaChanged]({
    surface, statePath: '/gather', context: { change: 'reorder', items: [asset('b'), asset('a')] },
  });
  assert.deepEqual(surface.dataModel.get('/gather').items.map((i) => i.assetId), ['b', 'a']);

  await handlers[GATHER_ACTION_IDS.mediaChanged]({
    surface, statePath: '/gather', context: { change: 'set', items: [asset('c')] },
  });
  assert.deepEqual(surface.dataModel.get('/gather').items.map((i) => i.assetId), ['c']);
});

test('a change with no usable payload leaves the collection alone', async () => {
  const handlers = createMediaCollectionHandlers({ persistCapture: async () => asset('x') });
  const surface = surfaceWith({ items: [asset('a')] });

  const next = await handlers[GATHER_ACTION_IDS.mediaChanged]({ surface, statePath: '/gather', context: {} });

  assert.deepEqual(next.map((item) => item.assetId), ['a']);
});

test('other keys in the state path survive a collection edit', async () => {
  const handlers = createMediaCollectionHandlers({ persistCapture: async () => asset('one') });
  const surface = surfaceWith({ items: [], status: 'capture', note: 'keep me' });

  await handlers[GATHER_ACTION_IDS.mediaCaptured]({
    surface, statePath: '/gather', context: { capture: { path: '/tmp/a.jpg' } },
  });

  const state = surface.dataModel.get('/gather');
  assert.equal(state.status, 'capture');
  assert.equal(state.note, 'keep me');
});

test('the collection requires a persist capability and a real capture', async () => {
  assert.throws(() => createMediaCollectionHandlers({}), /requires a persistCapture/);
  const handlers = createMediaCollectionHandlers({ persistCapture: async () => null });
  const surface = surfaceWith({ items: [] });
  await assert.rejects(
    () => handlers[GATHER_ACTION_IDS.mediaCaptured]({ surface, statePath: '/gather', context: {} }),
    /did not produce a photo/,
  );
  await assert.rejects(
    () => handlers[GATHER_ACTION_IDS.mediaCaptured]({ surface, statePath: '/gather', context: { capture: { path: 'a' } } }),
    /could not be saved/,
  );
});
