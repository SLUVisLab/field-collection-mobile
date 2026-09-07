import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createAppUserAuth, createSessionAuth } from '../../src/auth.js';
import { request, readJson } from '../../src/http.js';

/**
 * Opt-in LIVE M4.7.2 test: Dataset property accessFilter over the real App User
 * OpenRosa resource path, plus a real xforms-engine runtime choice-materialization
 * check. Restores prior dataset/user property state in finally.
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_EMAIL, ODK_CENTRAL_PASSWORD
 *   ODK_CENTRAL_ENTITY_FORM_ID (optional, default "silphium_flower_survey_entities")
 *   ODK_CENTRAL_DATASET (optional, default "plants")
 *   ODK_CENTRAL_M47_APP_USER_A_NAME (optional, default "m47-app-user-a")
 *   ODK_CENTRAL_M47_APP_USER_B_NAME (optional, default "m47-app-user-b")
 *   ODK_CENTRAL_M47_ACTOR_PROPERTY_NAME (optional, default "block")
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_EMAIL,
  ODK_CENTRAL_PASSWORD,
  ODK_CENTRAL_ENTITY_FORM_ID,
  ODK_CENTRAL_DATASET,
  ODK_CENTRAL_M47_APP_USER_A_NAME,
  ODK_CENTRAL_M47_APP_USER_B_NAME,
  ODK_CENTRAL_M47_ACTOR_PROPERTY_NAME,
} = process.env;

const DATASET = ODK_CENTRAL_DATASET || 'plants';
const FORM_ID = ODK_CENTRAL_ENTITY_FORM_ID || 'silphium_flower_survey_entities';
const APP_USER_A_NAME = ODK_CENTRAL_M47_APP_USER_A_NAME || 'm47-app-user-a';
const APP_USER_B_NAME = ODK_CENTRAL_M47_APP_USER_B_NAME || 'm47-app-user-b';
const ACTOR_PROPERTY_NAME = ODK_CENTRAL_M47_ACTOR_PROPERTY_NAME || 'block';
const ACCESS_FILTER = {
  type: 'property',
  rules: [{ datasetProperty: 'block', actorProperty: ACTOR_PROPERTY_NAME }],
};

const LIVE = Boolean(ODK_CENTRAL_URL && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_EMAIL && ODK_CENTRAL_PASSWORD);
const skip = LIVE ? false : 'live env not configured (set ODK_CENTRAL_URL/PROJECT_ID/EMAIL/PASSWORD to run)';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');

const adminClient = () =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createSessionAuth({ email: ODK_CENTRAL_EMAIL, password: ODK_CENTRAL_PASSWORD }),
    timeoutMs: 45000,
  });

const appUserClient = (token) =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createAppUserAuth(token),
    timeoutMs: 45000,
  });

const projectBase = () => `${ODK_CENTRAL_URL}/v1/projects/${encodeURIComponent(`${ODK_CENTRAL_PROJECT_ID}`)}`;

const adminRequestJson = async (client, { method, path, body, extendedMetadata = false }) => {
  await client.ensureAuth();
  const headers = {};
  if (extendedMetadata) headers['X-Extended-Metadata'] = 'true';
  if (body != null) headers['Content-Type'] = 'application/json';
  const response = await request({
    fetchImpl: globalThis.fetch,
    method,
    url: `${projectBase()}${path}`,
    auth: client.auth,
    headers,
    accept: 'application/json',
    body: body == null ? undefined : JSON.stringify(body),
    timeoutMs: 45000,
  });
  return readJson(response);
};

const listAppUsers = (client) => adminRequestJson(client, { method: 'GET', path: '/app-users', extendedMetadata: true });
const getAppUser = (client, id) =>
  adminRequestJson(client, { method: 'GET', path: `/app-users/${encodeURIComponent(`${id}`)}`, extendedMetadata: true });
const createAppUser = (client, displayName) => adminRequestJson(client, { method: 'POST', path: '/app-users', body: { displayName } });
const setAppUserProperties = (client, id, properties) =>
  adminRequestJson(client, { method: 'PATCH', path: `/app-users/${encodeURIComponent(`${id}`)}`, body: { properties } });
const deleteAppUser = (client, id) =>
  adminRequestJson(client, { method: 'DELETE', path: `/app-users/${encodeURIComponent(`${id}`)}` });
const assignAppUserToForm = (client, actorId) =>
  adminRequestJson(client, {
    method: 'POST',
    path: `/forms/${encodeURIComponent(FORM_ID)}/assignments/app-user/${encodeURIComponent(`${actorId}`)}`,
  });
const listAppUsersAssignedToForm = (client) =>
  adminRequestJson(client, {
    method: 'GET',
    path: `/forms/${encodeURIComponent(FORM_ID)}/assignments/app-user`,
  });

const ensureAppUserAssignedToForm = async (client, actorId) => {
  const assigned = await listAppUsersAssignedToForm(client);
  if (assigned.some((actor) => actor.id === actorId)) {
    return;
  }
  await assignAppUserToForm(client, actorId);
};

const findActiveByDisplayName = (users, displayName) =>
  users.find((user) => user.displayName === displayName && user.deletedAt == null) ?? null;

const ensureDedicatedAppUser = async (client, displayName) => {
  const users = await listAppUsers(client);
  const existing = findActiveByDisplayName(users, displayName);
  if (existing != null) return { created: false, user: existing };
  const created = await createAppUser(client, displayName);
  return { created: true, user: await getAppUser(client, created.id) };
};

const parseCsv = (text) => {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const keys = header.split(',');
  const rows = lines.filter((line) => line.length > 0).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(keys.map((key, index) => [key, cells[index] ?? '']));
  });
  return { header, rows };
};

const flatten = (node, acc = []) => {
  acc.push(node);
  for (const child of node.currentState?.children ?? []) flatten(child, acc);
  return acc;
};

const byRef = (root, ref) => flatten(root).find((node) => node.currentState?.reference === ref) ?? null;

const evaluateChoicesInRuntime = async ({ formXml, csvText }) => {
  const { installSlimdomDomCompatibility } = require(
    join(repoRoot, 'experiments', 'm2-slimdom-xforms', 'installDomCompatibility.js')
  );
  const dom = installSlimdomDomCompatibility({ force: true });
  try {
    const engineDistDir = join(repoRoot, 'node_modules', '@getodk', 'xforms-engine', 'dist');
    globalThis.__dirname = engineDistDir;
    globalThis.__filename = join(engineDistDir, 'index.js');
    if (typeof globalThis.require !== 'function') globalThis.require = require;

    const fetchFormAttachment = async (resourceUrl) => {
      const href = typeof resourceUrl === 'string' ? resourceUrl : resourceUrl?.href ?? String(resourceUrl);
      const filename = decodeURIComponent(href.split('/').pop() ?? '');
      if (filename === 'plants.csv') {
        return new Response(csvText, { status: 200, headers: { 'content-type': 'text/csv' } });
      }
      return new Response(null, { status: 404 });
    };

    const { loadForm } = await import('@getodk/xforms-engine');
    const loaded = await loadForm(formXml, { fetchFormAttachment });
    if (loaded.status === 'failure') {
      throw new Error(`xforms-engine failed to load: ${String(loaded.error?.message ?? loaded.error)}`);
    }
    const instance = await loaded.createInstance();
    const selectNode = byRef(instance.root, '/data/plant');
    const choices = selectNode?.currentState?.valueOptions ?? [];
    return { choiceCount: choices.length };
  } finally {
    dom.restore();
  }
};

const fetchFilteredEntityList = async ({ token }) => {
  const client = appUserClient(token);
  const forms = await client.listForms();
  const form = forms.find((entry) => entry.formId === FORM_ID);
  assert.ok(form, `expected form ${FORM_ID} in App User form list`);

  const formXml = await client.downloadForm({ formId: FORM_ID });
  const manifest = await client.getFormManifest({ formId: FORM_ID });
  const entityList = manifest.find((entry) => entry.isEntityList);
  assert.ok(entityList, 'expected an entityList entry in manifest');

  const response = await client.downloadFormAttachment({ formId: FORM_ID, filename: entityList.filename });
  assert.equal(response.status, 200);
  const csvText = await response.text();
  const parsed = parseCsv(csvText);
  return { csvText, rows: parsed.rows, header: parsed.header, formXml };
};

test('live: M4.7.2 property accessFilter restricts App User entityList CSV and runtime choices', { skip }, async () => {
  const admin = adminClient();
  const originalDataset = await admin.getDataset({ name: DATASET });
  const originalAccessFilter = originalDataset.accessFilter === undefined ? null : originalDataset.accessFilter;

  let fixtureA = null;
  let fixtureB = null;
  let originalBlockA = null;
  let originalBlockB = null;
  const createdUserIds = [];

  try {
    const actorProperties = await admin.listActorProperties();
    if (!actorProperties.some((row) => row.name === ACTOR_PROPERTY_NAME)) {
      await admin.registerActorProperty({ name: ACTOR_PROPERTY_NAME });
    }

    fixtureA = await ensureDedicatedAppUser(admin, APP_USER_A_NAME);
    fixtureB = await ensureDedicatedAppUser(admin, APP_USER_B_NAME);
    if (fixtureA.created) createdUserIds.push(fixtureA.user.id);
    if (fixtureB.created) createdUserIds.push(fixtureB.user.id);

    originalBlockA = fixtureA.user.properties?.[ACTOR_PROPERTY_NAME] ?? null;
    originalBlockB = fixtureB.user.properties?.[ACTOR_PROPERTY_NAME] ?? null;

    await setAppUserProperties(admin, fixtureA.user.id, { [ACTOR_PROPERTY_NAME]: 'A' });
    await setAppUserProperties(admin, fixtureB.user.id, { [ACTOR_PROPERTY_NAME]: 'B' });
    await ensureAppUserAssignedToForm(admin, fixtureA.user.id);
    await ensureAppUserAssignedToForm(admin, fixtureB.user.id);
    assert.equal(typeof fixtureA.user.token, 'string', 'App User A must have an active token');
    assert.equal(typeof fixtureB.user.token, 'string', 'App User B must have an active token');

    const updatedDataset = await admin.updateDataset({ name: DATASET, accessFilter: ACCESS_FILTER });
    assert.deepEqual(updatedDataset.accessFilter, ACCESS_FILTER);

    const [resultA, resultB] = await Promise.all([
      fetchFilteredEntityList({ token: fixtureA.user.token }),
      fetchFilteredEntityList({ token: fixtureB.user.token }),
    ]);

    assert.ok(resultA.rows.length > 0, 'App User A should receive at least one Entity');
    assert.ok(resultB.rows.length > 0, 'App User B should receive at least one Entity');
    assert.ok(resultA.rows.every((row) => row.block === 'A'), 'App User A CSV must contain only block=A rows');
    assert.ok(resultB.rows.every((row) => row.block === 'B'), 'App User B CSV must contain only block=B rows');

    const runtimeA = await evaluateChoicesInRuntime({ formXml: resultA.formXml, csvText: resultA.csvText });
    const runtimeB = await evaluateChoicesInRuntime({ formXml: resultB.formXml, csvText: resultB.csvText });
    assert.equal(runtimeA.choiceCount, resultA.rows.length, 'runtime A choices should match filtered CSV rows');
    assert.equal(runtimeB.choiceCount, resultB.rows.length, 'runtime B choices should match filtered CSV rows');

    console.log(`M472_LIVE_RESULT::${JSON.stringify({
      dataset: DATASET,
      formId: FORM_ID,
      accessFilter: updatedDataset.accessFilter,
      actorProperty: ACTOR_PROPERTY_NAME,
      appUserA: { displayName: APP_USER_A_NAME, rowCount: resultA.rows.length, choiceCount: runtimeA.choiceCount },
      appUserB: { displayName: APP_USER_B_NAME, rowCount: resultB.rows.length, choiceCount: runtimeB.choiceCount },
    }, null, 2)}`);
  } finally {
    if (fixtureA != null && !fixtureA.created) {
      await setAppUserProperties(admin, fixtureA.user.id, { [ACTOR_PROPERTY_NAME]: originalBlockA });
      const restoredA = await getAppUser(admin, fixtureA.user.id);
      assert.equal(restoredA.properties?.[ACTOR_PROPERTY_NAME] ?? null, originalBlockA);
    }
    if (fixtureB != null && !fixtureB.created) {
      await setAppUserProperties(admin, fixtureB.user.id, { [ACTOR_PROPERTY_NAME]: originalBlockB });
      const restoredB = await getAppUser(admin, fixtureB.user.id);
      assert.equal(restoredB.properties?.[ACTOR_PROPERTY_NAME] ?? null, originalBlockB);
    }
    await admin.updateDataset({ name: DATASET, accessFilter: originalAccessFilter });
    const restoredDataset = await admin.getDataset({ name: DATASET });
    assert.deepEqual(restoredDataset.accessFilter ?? null, originalAccessFilter);
    for (const userId of createdUserIds) {
      await deleteAppUser(admin, userId);
    }
  }
});
