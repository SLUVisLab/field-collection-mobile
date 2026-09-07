import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { OdkCentralClient } from '../src/OdkCentralClient.js';
import { createBearerAuth } from '../src/auth.js';
import { ODK_CENTRAL_ERROR_CODES } from '../src/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const readFixture = (name) => readFile(join(here, 'fixtures', name), 'utf-8');

/** Mock fetch that routes on a URL substring (mirrors client.test.mjs). */
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

const BASE = 'https://central.example.org';
const json = (body, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('listDatasets GETs the REST datasets route and returns the array', async () => {
  const body = await readFixture('datasets.list.json');
  const { fetchImpl, calls } = createMockFetch([
    { match: '/datasets', method: 'GET', respond: () => json(body) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const datasets = await client.listDatasets();
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/datasets`);
  assert.equal(datasets.length, 1);
  assert.equal(datasets[0].name, 'plants');
});

test('getDataset returns property schema with strings and linked/source forms', async () => {
  const body = await readFixture('dataset.plants.json');
  const { fetchImpl, calls } = createMockFetch([
    { match: '/datasets/plants', method: 'GET', respond: () => json(body) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const dataset = await client.getDataset({ name: 'plants' });
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/datasets/plants`);
  const propertyNames = dataset.properties.map((p) => p.name);
  // Schema matches the live plants Dataset; species is intentionally absent.
  assert.deepEqual(propertyNames, [
    'site', 'block', 'column', 'row', 'plant_code', 'geometry', 'status', 'registered_on', 'last_observed',
  ]);
  assert.ok(!propertyNames.includes('species'));
  assert.equal(dataset.linkedForms[0].xmlFormId, 'silphium_flower_survey_entities');
});

test('updateDataset PATCHes accessFilter and returns updated metadata', async () => {
  const body = await readFixture('access-filter.block.json');
  const accessFilter = {
    type: 'property',
    rules: [{ datasetProperty: 'block', actorProperty: 'block' }],
  };
  const { fetchImpl, calls } = createMockFetch([
    { match: '/datasets/plants', method: 'PATCH', respond: () => json(body) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const dataset = await client.updateDataset({ name: 'plants', accessFilter });
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/datasets/plants`);
  assert.equal(calls[0].options.method, 'PATCH');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), { accessFilter });
  assert.equal(dataset.name, 'plants');
  assert.deepEqual(dataset.accessFilter, accessFilter);
});

test('updateDataset can clear accessFilter with null', async () => {
  const { fetchImpl, calls } = createMockFetch([
    { match: '/datasets/plants', method: 'PATCH', respond: () => json({ name: 'plants', accessFilter: null }) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const dataset = await client.updateDataset({ name: 'plants', accessFilter: null });
  assert.deepEqual(JSON.parse(calls[0].options.body), { accessFilter: null });
  assert.equal(dataset.accessFilter, null);
});

test('listEntities returns metadata only (no per-Entity data key)', async () => {
  const body = await readFixture('entities.list.json');
  const { fetchImpl, calls } = createMockFetch([
    { match: '/datasets/plants/entities', method: 'GET', respond: () => json(body) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const entities = await client.listEntities({ name: 'plants' });
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/datasets/plants/entities`);
  assert.ok(entities.length >= 1);
  for (const entity of entities) {
    assert.equal(typeof entity.uuid, 'string');
    assert.equal(typeof entity.currentVersion.version, 'number');
    // The metadata list must NOT carry bulk property data.
    assert.ok(!('data' in entity.currentVersion), 'list entries must omit property data');
  }
});

test('getEntity returns currentVersion.data with string values and version metadata', async () => {
  const body = await readFixture('entity.detail.json');
  const uuid = '0ede576e-04a4-4266-8450-6d9a8cd24164';
  const { fetchImpl, calls } = createMockFetch([
    { match: `/entities/${uuid}`, method: 'GET', respond: () => json(body) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const entity = await client.getEntity({ name: 'plants', uuid });
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/datasets/plants/entities/${uuid}`);
  const data = entity.currentVersion.data;
  // Property values are strings, exactly as Central sends them (no coercion).
  for (const value of Object.values(data)) {
    assert.equal(typeof value, 'string');
  }
  assert.equal(data.site, 'Tyson');
  assert.equal(data.column, '1'); // numeric-looking but a string
  assert.equal(entity.currentVersion.version, 1);
  assert.equal(entity.currentVersion.baseVersion, null);
});

test('updateEntity PATCHes data with baseVersion query and returns updated entity', async () => {
  const uuid = '0ede576e-04a4-4266-8450-6d9a8cd24164';
  const responseBody = {
    uuid,
    conflict: null,
    currentVersion: {
      version: 2,
      baseVersion: 1,
      data: { status: 'missing' },
    },
  };
  const { fetchImpl, calls } = createMockFetch([
    { match: `/entities/${uuid}?baseVersion=1`, method: 'PATCH', respond: () => json(responseBody) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const updated = await client.updateEntity({
    name: 'plants',
    uuid,
    baseVersion: 1,
    data: { status: 'missing' },
  });
  assert.equal(
    calls[0].url,
    `${BASE}/v1/projects/1/datasets/plants/entities/${uuid}?baseVersion=1`
  );
  assert.equal(calls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.body), { data: { status: 'missing' } });
  assert.equal(updated.currentVersion.version, 2);
  assert.equal(updated.currentVersion.baseVersion, 1);
  assert.equal(updated.currentVersion.data.status, 'missing');
});

test('updateEntity maps stale baseVersion conflict to STALE_ENTITY_BASE_VERSION (non-retryable)', async () => {
  const uuid = '0ede576e-04a4-4266-8450-6d9a8cd24164';
  const staleBody = await readFixture('stale-base-version.error.json');
  const { fetchImpl } = createMockFetch([
    {
      match: `/entities/${uuid}?baseVersion=1`,
      method: 'PATCH',
      respond: () => json(staleBody, 409),
    },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  await assert.rejects(
    client.updateEntity({ name: 'plants', uuid, baseVersion: 1, data: { status: 'dead' } }),
    (error) => {
      assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.STALE_ENTITY_BASE_VERSION);
      assert.equal(error.httpStatus, 409);
      assert.equal(error.retryable, false);
      assert.equal(error.details.code, 409.15);
      assert.deepEqual(error.details.details, { current: '3', provided: '2' });
      return true;
    }
  );
});

test('empty Dataset yields an empty Entity metadata list', async () => {
  const { fetchImpl } = createMockFetch([
    { match: '/entities', method: 'GET', respond: () => json([]) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });
  assert.deepEqual(await client.listEntities({ name: 'empty' }), []);
});

test('empty-string Entity property values are preserved verbatim', async () => {
  const body = {
    uuid: 'u1',
    currentVersion: { version: 2, baseVersion: 1, data: { status: 'active', last_observed: '' } },
  };
  const { fetchImpl } = createMockFetch([
    { match: '/entities/u1', method: 'GET', respond: () => json(body) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });
  const entity = await client.getEntity({ name: 'plants', uuid: 'u1' });
  assert.equal(entity.currentVersion.data.last_observed, '');
  assert.equal(entity.currentVersion.data.status, 'active');
});

test('missing Dataset -> NOT_FOUND', async () => {
  const { fetchImpl } = createMockFetch([
    { match: '/datasets/nope', method: 'GET', respond: () => json({ code: 404.1, message: 'Could not find the resource.' }, 404) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });
  await assert.rejects(client.getDataset({ name: 'nope' }), (error) => {
    assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.NOT_FOUND);
    assert.equal(error.httpStatus, 404);
    return true;
  });
});

test('missing Entity -> NOT_FOUND', async () => {
  const { fetchImpl } = createMockFetch([
    { match: '/entities/ghost', method: 'GET', respond: () => json({ code: 404.1, message: 'Could not find the resource.' }, 404) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });
  await assert.rejects(client.getEntity({ name: 'plants', uuid: 'ghost' }), (error) => {
    assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.NOT_FOUND);
    return true;
  });
});

test('App User (unauthorized) on REST Dataset surface -> FORBIDDEN', async () => {
  const { fetchImpl } = createMockFetch([
    { match: '/datasets', method: 'GET', respond: () => json({ code: 403.1, message: 'The authenticated actor does not have rights.' }, 403) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });
  await assert.rejects(client.listDatasets(), (error) => {
    assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.FORBIDDEN);
    return true;
  });
});

test('expired session on Dataset read -> AUTH', async () => {
  const { fetchImpl } = createMockFetch([
    { match: '/datasets/plants', method: 'GET', respond: () => json({ code: 401.2, message: 'Could not authenticate.' }, 401) },
  ]);
  const client = new OdkCentralClient({
    baseUrl: BASE,
    projectId: 1,
    fetch: fetchImpl,
    auth: createBearerAuth('tkn'),
  });
  await assert.rejects(client.getDataset({ name: 'plants' }), (error) => {
    assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.AUTH);
    return true;
  });
});

test('malformed JSON body on Dataset read -> PARSE', async () => {
  const { fetchImpl } = createMockFetch([
    { match: '/datasets/plants', method: 'GET', respond: () => new Response('{not json', { status: 200, headers: { 'Content-Type': 'application/json' } }) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });
  await assert.rejects(client.getDataset({ name: 'plants' }), (error) => {
    assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.PARSE);
    return true;
  });
});

test('downloadDatasetEntitiesCsv returns the raw Response (client does not parse)', async () => {
  const csv = await readFixture('plants.csv');
  const { fetchImpl, calls } = createMockFetch([
    { match: '/entities.csv', method: 'GET', respond: () => new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv' } }) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });
  const response = await client.downloadDatasetEntitiesCsv({ name: 'plants' });
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/datasets/plants/entities.csv`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /^name,label,__version/);
});

test('Dataset/Entity methods validate required arguments', async () => {
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: async () => json({}) });
  await assert.rejects(client.getDataset({}), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateDataset({ name: 'plants' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateDataset({ accessFilter: null }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateDataset({ name: 'plants', ownerOnly: 'no' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateDataset({ name: 'plants', approvalRequired: 'yes' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateDataset({ name: 'plants', accessFilter: 'bad-shape' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.listEntities({}), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.getEntity({ name: 'plants' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.getEntity({ uuid: 'x' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateEntity({ name: 'plants', uuid: 'u1', data: { status: 'x' } }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateEntity({ name: 'plants', uuid: 'u1', baseVersion: 1 }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateEntity({ name: 'plants', uuid: 'u1', baseVersion: 1.5, data: {} }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateEntity({ name: 'plants', uuid: 'u1', baseVersion: 1, data: 'bad' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateEntity({ name: 'plants', uuid: 'u1', baseVersion: 1, data: {}, label: '' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateEntity({ name: 'plants', uuid: 'u1', data: {}, force: 'yes' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.updateEntity({ name: 'plants', uuid: 'u1', data: {}, resolve: 'yes' }), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  await assert.rejects(client.downloadDatasetEntitiesCsv({}), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
});
