import test from 'node:test';
import assert from 'node:assert/strict';

import { XFormsHost } from '../../odk-xforms-host/src/index.js';
import { XFormsStore, XFORMS_REACT_PHASES, areNodeStatesEqual } from '../src/XFormsStore.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const makeSnapshot = (fields) => ({
  generatedAt: new Date().toISOString(),
  nodeCount: Object.keys(fields).length,
  nodesByReference: clone(fields),
});

class FakeHost extends XFormsHost {
  constructor() {
    super();
    this.listeners = new Set();
    this.disposed = false;
    this.failSetValue = false;
    this.snapshot = makeSnapshot({
      '/data/age': {
        reference: '/data/age',
        value: '18',
        relevant: true,
        required: true,
        readonly: false,
        constraintValid: true,
      },
      '/data/calc': {
        reference: '/data/calc',
        value: '20.5',
        relevant: true,
        required: false,
        readonly: true,
        constraintValid: null,
      },
      '/data/show_extra': {
        reference: '/data/show_extra',
        value: '0',
        relevant: true,
        required: false,
        readonly: false,
        constraintValid: null,
      },
      '/data/extra': {
        reference: '/data/extra',
        value: '',
        relevant: false,
        required: false,
        readonly: false,
        constraintValid: null,
      },
      '/data/choice': {
        reference: '/data/choice',
        value: ['apple'],
        valueType: 'string',
        instanceValue: 'apple',
        relevant: true,
        required: false,
        readonly: false,
        constraintValid: null,
      },
      '/data/rep': {
        reference: '/data/rep',
        value: null,
        relevant: true,
        required: false,
        readonly: false,
        constraintValid: null,
      },
      '/data/rep[2]': {
        reference: '/data/rep[2]',
        value: null,
        relevant: true,
        required: false,
        readonly: false,
        constraintValid: null,
      },
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async initialize() {
    return { initialized: true };
  }

  async loadForm(xml) {
    if (typeof xml !== 'string' || xml.length === 0) {
      throw new Error('xml required');
    }
    return {
      loadStatus: 'success',
      snapshot: clone(this.snapshot),
    };
  }

  async getSnapshot() {
    return clone(this.snapshot);
  }

  async setValue(reference, value) {
    if (this.failSetValue) {
      throw new Error('setValue failed');
    }
    const next = clone(this.snapshot);
    const node = next.nodesByReference[reference];
    if (node == null) {
      throw new Error(`missing node: ${reference}`);
    }
    node.value = String(value);
    if (reference === '/data/show_extra') {
      next.nodesByReference['/data/extra'].relevant = String(value) === '1';
    }
    if (reference === '/data/age') {
      next.nodesByReference['/data/age'].constraintValid = Number(value) >= 18;
    }
    this.snapshot = next;
    this.emit({
      type: 'stateChanged',
      payload: { changed: [reference] },
    });
    return {
      snapshot: clone(this.snapshot),
    };
  }

  async addRepeat(reference) {
    if (reference !== '/data/rep') {
      throw new Error('unexpected repeat');
    }
    const next = clone(this.snapshot);
    const existingIndexes = Object.keys(next.nodesByReference)
      .map((key) => key.match(/^\/data\/rep\[(\d+)\]$/))
      .filter(Boolean)
      .map((match) => Number(match[1]));
    const index = (existingIndexes.length === 0 ? 1 : Math.max(...existingIndexes)) + 1;
    next.nodesByReference[`/data/rep[${index}]`] = {
      reference: `/data/rep[${index}]`,
      value: null,
      relevant: true,
      required: false,
      readonly: false,
      constraintValid: null,
    };
    next.nodeCount = Object.keys(next.nodesByReference).length;
    this.snapshot = next;
    this.emit({
      type: 'stateChanged',
      payload: { changed: ['/data/rep'] },
    });
    return { snapshot: clone(this.snapshot) };
  }

  async removeRepeat(reference, instanceId = null) {
    if (reference !== '/data/rep') {
      throw new Error('unexpected repeat');
    }
    const next = clone(this.snapshot);
    const toRemove = instanceId == null ? '/data/rep[2]' : `/data/rep[${instanceId}]`;
    delete next.nodesByReference[toRemove];
    next.nodeCount = Object.keys(next.nodesByReference).length;
    this.snapshot = next;
    this.emit({
      type: 'stateChanged',
      payload: { changed: ['/data/rep'] },
    });
    return { snapshot: clone(this.snapshot) };
  }

  async serialize() {
    return { xml: '<data id="fixture" />' };
  }

  async inspectMediaSeam() {
    return { note: 'logical references only' };
  }

  async dispose() {
    this.disposed = true;
  }
}

test('XFormsStore loadForm initializes host state and snapshot', async () => {
  const host = new FakeHost();
  const store = new XFormsStore({ host });
  await store.loadForm('<xml />');
  const state = store.getState();
  assert.equal(state.phase, XFORMS_REACT_PHASES.READY);
  assert.equal(state.snapshot.nodesByReference['/data/age'].value, '18');
  await store.dispose();
  assert.equal(host.disposed, true);
});

test('XFormsStore selector subscriptions notify only when selected node changes', async () => {
  const host = new FakeHost();
  const store = new XFormsStore({ host });
  await store.loadForm('<xml />');

  let notifyCount = 0;
  const unsubscribe = store.subscribeToSelection(
    (state) => state.snapshot?.nodesByReference?.['/data/age'] ?? null,
    areNodeStatesEqual,
    () => {
      notifyCount += 1;
    }
  );

  await store.setValue('/data/show_extra', 1);
  assert.equal(notifyCount, 0);

  await store.setValue('/data/age', 17);
  assert.equal(notifyCount, 1);
  assert.equal(store.getState().snapshot.nodesByReference['/data/age'].constraintValid, false);

  unsubscribe();
  await store.dispose();
});

test('XFormsStore supports repeat mutations and serialize', async () => {
  const host = new FakeHost();
  const store = new XFormsStore({ host });
  await store.loadForm('<xml />');

  const beforeCount = store.getState().snapshot.nodeCount;
  await store.addRepeat('/data/rep');
  const afterAddCount = store.getState().snapshot.nodeCount;
  assert.equal(afterAddCount > beforeCount, true);

  await store.removeRepeat('/data/rep', 2);
  const afterRemoveCount = store.getState().snapshot.nodeCount;
  assert.equal(afterRemoveCount < afterAddCount, true);

  const serialized = await store.serialize();
  assert.equal(serialized.xml.includes('<data id='), true);
  await store.dispose();
});

test('XFormsStore preserves the runtime-value vs instance-value distinction for selects', async () => {
  const host = new FakeHost();
  const store = new XFormsStore({ host });
  await store.loadForm('<xml />');

  const choice = store.getState().snapshot.nodesByReference['/data/choice'];
  // Runtime value is set-shaped (engine models even <select1> as a set)...
  assert.deepEqual(choice.value, ['apple']);
  // ...while the serialized instance leaf (<choice>apple</choice>) is scalar.
  assert.equal(choice.instanceValue, 'apple');
  assert.notDeepEqual(choice.value, choice.instanceValue);

  await store.dispose();
});

test('XFormsStore surfaces host errors and moves to error phase', async () => {
  const host = new FakeHost();
  const store = new XFormsStore({ host });
  await store.loadForm('<xml />');
  host.failSetValue = true;

  await assert.rejects(store.setValue('/data/age', 21), /setValue failed/);
  assert.equal(store.getState().phase, XFORMS_REACT_PHASES.ERROR);
  assert.equal(store.getState().error instanceof Error, true);

  await store.dispose();
  await assert.rejects(store.loadForm('<xml />'), /disposed/i);
});
