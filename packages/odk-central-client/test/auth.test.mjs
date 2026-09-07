import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBearerAuth,
  createBasicAuth,
  createAppUserAuth,
  createSessionAuth,
  createNoAuth,
  toBase64,
} from '../src/auth.js';

const BASE = 'https://c.example.org/v1/projects/1/formList';

test('bearer auth adds Authorization header', () => {
  const { url, headers } = createBearerAuth('tok').applyToRequest({ url: BASE, headers: {} });
  assert.equal(url, BASE);
  assert.equal(headers.Authorization, 'Bearer tok');
});

test('basic auth encodes credentials', () => {
  const { headers } = createBasicAuth({ email: 'a@b.co', password: 'pw' }).applyToRequest({
    url: BASE,
    headers: {},
  });
  assert.equal(headers.Authorization, `Basic ${toBase64('a@b.co:pw')}`);
});

test('app user auth rewrites the URL with a /key/<token> prefix after /v1', () => {
  const { url, headers } = createAppUserAuth('APPTOKEN').applyToRequest({ url: BASE, headers: {} });
  assert.equal(url, 'https://c.example.org/v1/key/APPTOKEN/projects/1/formList');
  assert.equal(headers.Authorization, undefined);
});

test('session auth is a no-op until a token is set, then behaves like bearer', () => {
  const auth = createSessionAuth({ email: 'a@b.co', password: 'pw' });
  assert.equal(auth.requiresLogin, true);
  let applied = auth.applyToRequest({ url: BASE, headers: {} });
  assert.equal(applied.headers.Authorization, undefined);
  auth.setToken('session-tok');
  applied = auth.applyToRequest({ url: BASE, headers: {} });
  assert.equal(applied.headers.Authorization, 'Bearer session-tok');
  assert.equal(auth.getToken(), 'session-tok');
});

test('no-op auth leaves the request untouched', () => {
  const req = { url: BASE, headers: { a: '1' } };
  assert.deepEqual(createNoAuth().applyToRequest(req), req);
});
