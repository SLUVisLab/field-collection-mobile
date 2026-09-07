import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CredentialError,
  createCredentialStore,
  projectCredentialKeys,
  projectTokenKey,
} from '../src/credentials.js';
import { GatherPathError } from '../src/paths.js';

/** In-memory SecureStore-like adapter for testing the injected seam. */
const makeFakeStore = () => {
  const map = new Map();
  return {
    map,
    calls: [],
    async setItemAsync(key, value) {
      this.calls.push(['set', key]);
      map.set(key, value);
    },
    async getItemAsync(key) {
      this.calls.push(['get', key]);
      return map.has(key) ? map.get(key) : null;
    },
    async deleteItemAsync(key) {
      this.calls.push(['delete', key]);
      map.delete(key);
    },
  };
};

test('projectTokenKey is Gather-namespaced and project-scoped', () => {
  assert.equal(projectTokenKey('abc'), 'gather.project.abc.appUserToken');
  assert.equal(projectTokenKey('proj-1'), 'gather.project.proj-1.appUserToken');
});

test('SecureStore keys only use the allowed charset [A-Za-z0-9._-]', () => {
  for (const pk of ['abc', 'proj-1', 'proj_2', 'a.b', 'A1b2_-.x']) {
    assert.match(projectTokenKey(pk), /^[A-Za-z0-9._-]+$/);
  }
});

test('key generation rejects invalid/traversal project keys', () => {
  for (const bad of ['..', 'a/b', 'a b', '']) {
    assert.throws(() => projectTokenKey(bad), GatherPathError);
  }
});

test('projectCredentialKeys enumerates every owned key', () => {
  assert.deepEqual(projectCredentialKeys('abc'), ['gather.project.abc.appUserToken']);
});

test('credential lifecycle: set → get → delete via injected store', async () => {
  const store = makeFakeStore();
  const creds = createCredentialStore(store);

  assert.equal(await creds.getProjectToken('abc'), null);

  await creds.setProjectToken('abc', 'secret-token');
  assert.equal(await creds.getProjectToken('abc'), 'secret-token');
  // Stored under the namespaced key, not the raw project key.
  assert.ok(store.map.has('gather.project.abc.appUserToken'));

  const removed = await creds.deleteProjectCredentials('abc');
  assert.equal(removed, 1);
  assert.equal(await creds.getProjectToken('abc'), null);
});

test('projects are isolated: deleting one leaves the other intact', async () => {
  const store = makeFakeStore();
  const creds = createCredentialStore(store);
  await creds.setProjectToken('projA', 'tokA');
  await creds.setProjectToken('projB', 'tokB');

  await creds.deleteProjectCredentials('projA');
  assert.equal(await creds.getProjectToken('projA'), null);
  assert.equal(await creds.getProjectToken('projB'), 'tokB');
});

test('empty/invalid tokens are rejected', async () => {
  const creds = createCredentialStore(makeFakeStore());
  await assert.rejects(() => creds.setProjectToken('abc', ''), CredentialError);
  await assert.rejects(() => creds.setProjectToken('abc', undefined), CredentialError);
});

test('createCredentialStore requires a SecureStore-like adapter', () => {
  assert.throws(() => createCredentialStore(null), CredentialError);
  assert.throws(() => createCredentialStore({}), CredentialError);
  assert.throws(() => createCredentialStore({ setItemAsync() {} }), CredentialError);
});
