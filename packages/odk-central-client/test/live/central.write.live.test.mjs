import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createAppUserAuth } from '../../src/auth.js';
import { ODK_CENTRAL_ERROR_CODES } from '../../src/errors.js';

/**
 * Opt-in LIVE write-path tests against a real stock ODK Central instance.
 *
 * SKIPPED unless the required env is present, so the fast unit suite never
 * writes to a server. These create real (clearly-marked) test submissions.
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_APP_USER_TOKEN, ODK_CENTRAL_FORM_ID
 *   ODK_CENTRAL_EMAIL, ODK_CENTRAL_PASSWORD   (Web User, for REST read-back)
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_APP_USER_TOKEN,
  ODK_CENTRAL_FORM_ID,
  ODK_CENTRAL_EMAIL,
  ODK_CENTRAL_PASSWORD,
} = process.env;

const LIVE = Boolean(
  ODK_CENTRAL_URL && ODK_CENTRAL_APP_USER_TOKEN && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_FORM_ID
);
const skip = LIVE ? false : 'live env not configured (set ODK_CENTRAL_* to run)';

const client = () =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createAppUserAuth(ODK_CENTRAL_APP_USER_TOKEN),
    timeoutMs: 45000,
  });

// A 1x1 PNG, generated at test time so no binary asset lives in the repo.
const tinyPng = () =>
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

const instanceXml = (instanceId, { withPhoto = false, fieldSite = 'M4.3 live', version = '' } = {}) => `<?xml version="1.0"?>
<data id="${ODK_CENTRAL_FORM_ID}" version="${version}">
  <field_site>${fieldSite}</field_site>
  <block>1</block><column>1</column><row>1</row>
  <flower_head_count>2</flower_head_count>
  <plant_height_cm>10.0</plant_height_cm>
  ${withPhoto ? `<flower_photos><photo_type>whole_plant</photo_type><flower_photo>tiny.png</flower_photo></flower_photos>` : ''}
  <meta><instanceID>${instanceId}</instanceID><instanceName>m4.3-live</instanceName></meta>
</data>`;

/** Central rejects a submission whose `version` attribute does not match a real
 * form version, so live write tests fetch the current version first. */
async function currentFormVersion(c) {
  const forms = await c.listForms();
  const form = forms.find((f) => f.formId === ODK_CENTRAL_FORM_ID);
  assert.ok(form, `form ${ODK_CENTRAL_FORM_ID} not visible to App User`);
  return form.version;
}

async function webUserGet(path) {
  const login = await fetch(`${ODK_CENTRAL_URL}/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ODK_CENTRAL_EMAIL, password: ODK_CENTRAL_PASSWORD }),
  });
  const { token } = await login.json();
  return fetch(`${ODK_CENTRAL_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

test('live: submit without media returns 201 and echoes instanceId', { skip }, async () => {
  const c = client();
  const version = await currentFormVersion(c);
  const instanceId = `uuid:${randomUUID()}`;
  const result = await c.submit({ xml: instanceXml(instanceId, { version }) });
  assert.equal(result.status, 201);
  assert.equal(result.instanceId, instanceId);
  assert.match(result.message, /successful/i);
});

test('live: resubmitting the same instanceId with different XML -> DUPLICATE_INSTANCE', { skip }, async () => {
  const c = client();
  const version = await currentFormVersion(c);
  const instanceId = `uuid:${randomUUID()}`;
  await c.submit({ xml: instanceXml(instanceId, { version, fieldSite: 'original' }) });
  await assert.rejects(
    c.submit({ xml: instanceXml(instanceId, { version, fieldSite: 'CHANGED' }) }),
    (error) => {
      assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.DUPLICATE_INSTANCE);
      assert.equal(error.retryable, false);
      return true;
    }
  );
});

test('live: submit with media, then verify attachment round-trips by md5', { skip: skip || !ODK_CENTRAL_EMAIL }, async () => {
  const c = client();
  const version = await currentFormVersion(c);
  const instanceId = `uuid:${randomUUID()}`;
  const png = tinyPng();
  const result = await c.submit({
    xml: instanceXml(instanceId, { withPhoto: true, version }),
    attachments: [{ name: 'tiny.png', contentType: 'image/png', data: png }],
  });
  assert.equal(result.status, 201);

  // Read the attachment back through the Central REST API (Web User) and compare bytes.
  const path = `/v1/projects/${ODK_CENTRAL_PROJECT_ID}/forms/${ODK_CENTRAL_FORM_ID}/submissions/${encodeURIComponent(instanceId)}/attachments/tiny.png`;
  const res = await webUserGet(path);
  assert.equal(res.status, 200);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(createHash('md5').update(bytes).digest('hex'), createHash('md5').update(png).digest('hex'));
});
