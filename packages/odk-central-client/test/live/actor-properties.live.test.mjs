import test from 'node:test';
import assert from 'node:assert/strict';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createSessionAuth } from '../../src/auth.js';
import { request, readJson } from '../../src/http.js';

/**
 * Opt-in LIVE M4.7.1 test: actor-property registration + dedicated integration
 * App User configuration (block=A/B).
 *
 * This test intentionally uses a private/raw helper for App User provisioning so
 * we avoid expanding public admin APIs prematurely. It only mutates dedicated
 * integration users by displayName.
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_EMAIL, ODK_CENTRAL_PASSWORD
 *   ODK_CENTRAL_M47_APP_USER_A_NAME (optional, default "m47-app-user-a")
 *   ODK_CENTRAL_M47_APP_USER_B_NAME (optional, default "m47-app-user-b")
 *   ODK_CENTRAL_M47_ACTOR_PROPERTY_NAME (optional, default "block")
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_EMAIL,
  ODK_CENTRAL_PASSWORD,
  ODK_CENTRAL_M47_APP_USER_A_NAME,
  ODK_CENTRAL_M47_APP_USER_B_NAME,
  ODK_CENTRAL_M47_ACTOR_PROPERTY_NAME,
} = process.env;

const LIVE = Boolean(ODK_CENTRAL_URL && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_EMAIL && ODK_CENTRAL_PASSWORD);
const skip = LIVE ? false : 'live env not configured (set ODK_CENTRAL_URL/PROJECT_ID/EMAIL/PASSWORD to run)';

const APP_USER_A_NAME = ODK_CENTRAL_M47_APP_USER_A_NAME || 'm47-app-user-a';
const APP_USER_B_NAME = ODK_CENTRAL_M47_APP_USER_B_NAME || 'm47-app-user-b';
const ACTOR_PROPERTY_NAME = ODK_CENTRAL_M47_ACTOR_PROPERTY_NAME || 'block';

const adminClient = () =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createSessionAuth({ email: ODK_CENTRAL_EMAIL, password: ODK_CENTRAL_PASSWORD }),
    timeoutMs: 45000,
  });

const projectBase = () => `${ODK_CENTRAL_URL}/v1/projects/${encodeURIComponent(`${ODK_CENTRAL_PROJECT_ID}`)}`;

const adminRequestJson = async (client, { method, path, body, extendedMetadata = false }) => {
  await client.ensureAuth();
  const headers = {};
  if (extendedMetadata) {
    headers['X-Extended-Metadata'] = 'true';
  }
  if (body != null) {
    headers['Content-Type'] = 'application/json';
  }
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

const listAppUsers = (client) =>
  adminRequestJson(client, {
    method: 'GET',
    path: '/app-users',
    extendedMetadata: true,
  });

const getAppUser = (client, id) =>
  adminRequestJson(client, {
    method: 'GET',
    path: `/app-users/${encodeURIComponent(`${id}`)}`,
    extendedMetadata: true,
  });

const createAppUser = (client, displayName) =>
  adminRequestJson(client, {
    method: 'POST',
    path: '/app-users',
    body: { displayName },
  });

const setAppUserProperties = (client, id, properties) =>
  adminRequestJson(client, {
    method: 'PATCH',
    path: `/app-users/${encodeURIComponent(`${id}`)}`,
    body: { properties },
  });

const findActiveByDisplayName = (users, displayName) =>
  users.find((user) => user.displayName === displayName && user.deletedAt == null) ?? null;

const ensureDedicatedAppUser = async (client, displayName) => {
  const users = await listAppUsers(client);
  const existing = findActiveByDisplayName(users, displayName);
  if (existing != null) {
    return { created: false, user: existing };
  }
  const created = await createAppUser(client, displayName);
  return { created: true, user: await getAppUser(client, created.id) };
};

test('live: M4.7.1 registers actor property and configures dedicated block=A/B App Users', { skip }, async () => {
  const admin = adminClient();

  const actorProperties = await admin.listActorProperties();
  const hasProperty = actorProperties.some((row) => row.name === ACTOR_PROPERTY_NAME);
  if (!hasProperty) {
    await admin.registerActorProperty({ name: ACTOR_PROPERTY_NAME });
  }

  const propertiesAfter = await admin.listActorProperties({ extendedMetadata: true });
  const blockProperty = propertiesAfter.find((row) => row.name === ACTOR_PROPERTY_NAME);
  assert.ok(blockProperty, `expected actor property "${ACTOR_PROPERTY_NAME}" to exist`);

  const userA = await ensureDedicatedAppUser(admin, APP_USER_A_NAME);
  const userB = await ensureDedicatedAppUser(admin, APP_USER_B_NAME);
  assert.notEqual(userA.user.id, userB.user.id, 'A and B users must be distinct identities');

  const updatedA = await setAppUserProperties(admin, userA.user.id, { [ACTOR_PROPERTY_NAME]: 'A' });
  const updatedB = await setAppUserProperties(admin, userB.user.id, { [ACTOR_PROPERTY_NAME]: 'B' });
  assert.equal(updatedA.properties?.[ACTOR_PROPERTY_NAME], 'A');
  assert.equal(updatedB.properties?.[ACTOR_PROPERTY_NAME], 'B');
  assert.equal(typeof updatedA.token, 'string');
  assert.equal(typeof updatedB.token, 'string');

  const verifyA = await getAppUser(admin, userA.user.id);
  const verifyB = await getAppUser(admin, userB.user.id);
  assert.equal(verifyA.properties?.[ACTOR_PROPERTY_NAME], 'A');
  assert.equal(verifyB.properties?.[ACTOR_PROPERTY_NAME], 'B');
});
