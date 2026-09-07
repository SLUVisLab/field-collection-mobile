import test from 'node:test';
import assert from 'node:assert/strict';

import { OdkCentralClient } from '../src/OdkCentralClient.js';
import { ODK_CENTRAL_ERROR_CODES } from '../src/errors.js';

const BASE = 'https://central.example.org';

const json = (body, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createMockFetch = (routes) => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    for (const route of routes) {
      if (url.includes(route.match) && (route.method == null || route.method === options.method)) {
        return typeof route.respond === 'function' ? route.respond({ url, options }) : route.respond;
      }
    }
    throw new Error(`No mock route for ${options.method} ${url}`);
  };
  return { fetchImpl, calls };
};

test('listActorProperties GETs the actor-properties route and returns rows', async () => {
  const { fetchImpl, calls } = createMockFetch([
    { match: '/actor-properties', method: 'GET', respond: () => json([{ name: 'block' }]) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const rows = await client.listActorProperties();
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/actor-properties`);
  assert.deepEqual(rows, [{ name: 'block' }]);
});

test('listActorProperties sends X-Extended-Metadata when requested', async () => {
  const { fetchImpl, calls } = createMockFetch([
    { match: '/actor-properties', method: 'GET', respond: () => json([{ name: 'block', values: ['A', 'B'] }]) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const rows = await client.listActorProperties({ extendedMetadata: true });
  assert.equal(calls[0].options.headers['X-Extended-Metadata'], 'true');
  assert.deepEqual(rows[0], { name: 'block', values: ['A', 'B'] });
});

test('registerActorProperty POSTs JSON payload and returns response body', async () => {
  const { fetchImpl, calls } = createMockFetch([
    { match: '/actor-properties', method: 'POST', respond: () => json({ success: true }) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const result = await client.registerActorProperty({ name: 'block' });
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/actor-properties`);
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].options.body, JSON.stringify({ name: 'block' }));
  assert.deepEqual(result, { success: true });
});

test('actor-property methods validate required args', async () => {
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: async () => json({}) });
  await assert.rejects(client.registerActorProperty({}), (error) => {
    assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.CONFIG);
    return true;
  });
  await assert.rejects(client.registerActorProperty({ name: '' }), (error) => {
    assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.CONFIG);
    return true;
  });
});
