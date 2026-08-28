import test from 'node:test';
import assert from 'node:assert/strict';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createSessionAuth, createAppUserAuth } from '../../src/auth.js';
import { ODK_CENTRAL_ERROR_CODES } from '../../src/errors.js';

/**
 * Opt-in LIVE Dataset/Entity read-path tests (M4.6.2) against a real stock ODK
 * Central instance. SKIPPED unless env is present, so the fast unit suite never
 * touches the network. These are READ-ONLY (no Entity is created or mutated).
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID
 *   ODK_CENTRAL_EMAIL, ODK_CENTRAL_PASSWORD        (Web User — REST Dataset surface)
 *   ODK_CENTRAL_APP_USER_TOKEN                     (App User — to assert the 403 boundary)
 *   ODK_CENTRAL_DATASET (optional, default "plants")
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_EMAIL,
  ODK_CENTRAL_PASSWORD,
  ODK_CENTRAL_APP_USER_TOKEN,
  ODK_CENTRAL_DATASET,
} = process.env;

const DATASET = ODK_CENTRAL_DATASET || 'plants';
const LIVE = Boolean(ODK_CENTRAL_URL && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_EMAIL && ODK_CENTRAL_PASSWORD);
const skip = LIVE ? false : 'live env not configured (set ODK_CENTRAL_URL/PROJECT_ID/EMAIL/PASSWORD to run)';

const webUserClient = () =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createSessionAuth({ email: ODK_CENTRAL_EMAIL, password: ODK_CENTRAL_PASSWORD }),
    timeoutMs: 30000,
  });

test('live: listDatasets includes the target Dataset', { skip }, async () => {
  const datasets = await webUserClient().listDatasets();
  assert.ok(Array.isArray(datasets) && datasets.length >= 1);
  assert.ok(datasets.some((d) => d.name === DATASET), `expected Dataset ${DATASET}`);
});

test('live: getDataset exposes a property schema (strings) and linked forms', { skip }, async () => {
  const dataset = await webUserClient().getDataset({ name: DATASET });
  assert.equal(dataset.name, DATASET);
  assert.ok(Array.isArray(dataset.properties) && dataset.properties.length >= 1);
  for (const property of dataset.properties) {
    assert.equal(typeof property.name, 'string');
  }
  // plants: species intentionally omitted (do not assert its presence).
  assert.ok(!dataset.properties.some((p) => p.name === 'species'));
});

test('live: listEntities returns metadata (no bulk data key)', { skip }, async () => {
  const entities = await webUserClient().listEntities({ name: DATASET });
  assert.ok(Array.isArray(entities));
  for (const entity of entities.slice(0, 5)) {
    assert.equal(typeof entity.uuid, 'string');
    assert.equal(typeof entity.currentVersion.version, 'number');
    assert.ok(!('data' in entity.currentVersion), 'metadata list must omit property data');
  }
});

test('live: getEntity returns full data with string property values', { skip }, async () => {
  const client = webUserClient();
  const [first] = await client.listEntities({ name: DATASET });
  if (first == null) return; // empty Dataset
  const entity = await client.getEntity({ name: DATASET, uuid: first.uuid });
  assert.equal(entity.uuid, first.uuid);
  const data = entity.currentVersion.data;
  assert.equal(typeof data, 'object');
  for (const value of Object.values(data)) {
    assert.equal(typeof value, 'string');
  }
  assert.equal(typeof entity.currentVersion.version, 'number');
});

test('live: downloadDatasetEntitiesCsv returns the REST/admin CSV shape', { skip }, async () => {
  const response = await webUserClient().downloadDatasetEntitiesCsv({ name: DATASET });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/csv/);
  const header = (await response.text()).split('\n', 1)[0];
  // REST export is OData-flavored: __id + __version, distinct from the field-client CSV.
  assert.match(header, /^__id,/);
  assert.match(header, /__version/);
});

test('live: missing Dataset -> NOT_FOUND', { skip }, async () => {
  await assert.rejects(
    webUserClient().getDataset({ name: 'definitely_not_a_dataset_zzz' }),
    (error) => {
      assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.NOT_FOUND);
      return true;
    }
  );
});

test('live: App User is forbidden on the REST Dataset surface', { skip: skip || !ODK_CENTRAL_APP_USER_TOKEN }, async () => {
  const appUser = new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createAppUserAuth(ODK_CENTRAL_APP_USER_TOKEN),
    timeoutMs: 30000,
  });
  await assert.rejects(appUser.listDatasets(), (error) => {
    assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.FORBIDDEN);
    return true;
  });
});
