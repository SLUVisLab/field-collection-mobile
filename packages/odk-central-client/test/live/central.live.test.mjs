import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createAppUserAuth } from '../../src/auth.js';

/**
 * Opt-in live integration tests against a real stock ODK Central instance.
 *
 * These are SKIPPED unless the required environment variables are present, so
 * the ordinary fast unit suite never touches the network. Credentials must come
 * from the environment (never committed):
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_APP_USER_TOKEN, ODK_CENTRAL_FORM_ID
 *
 * To run: source your out-of-repo env file, then `node --test test/live`.
 * Scope: OpenRosa App-User READ path only (no submissions are created here).
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_APP_USER_TOKEN,
  ODK_CENTRAL_FORM_ID,
} = process.env;

const LIVE = Boolean(ODK_CENTRAL_URL && ODK_CENTRAL_APP_USER_TOKEN && ODK_CENTRAL_PROJECT_ID);
const skip = LIVE ? false : 'live env not configured (set ODK_CENTRAL_* to run)';

const makeClient = () =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createAppUserAuth(ODK_CENTRAL_APP_USER_TOKEN),
    timeoutMs: 30000,
  });

const md5Hex = (buffer) => createHash('md5').update(Buffer.from(buffer)).digest('hex');

test('live: App User lists forms and finds the integration form', { skip }, async () => {
  const forms = await makeClient().listForms();
  assert.ok(forms.length >= 1, 'App User should see at least one granted form');
  const target = forms.find((f) => f.formId === ODK_CENTRAL_FORM_ID);
  assert.ok(target, `expected form ${ODK_CENTRAL_FORM_ID} in the App User form list`);
  assert.match(target.hash, /^md5:/);
});

test('live: getFormManifest returns real mediaFile entries', { skip }, async () => {
  const entries = await makeClient().getFormManifest({ formId: ODK_CENTRAL_FORM_ID });
  assert.ok(Array.isArray(entries));
  for (const entry of entries) {
    assert.equal(typeof entry.filename, 'string');
    assert.match(entry.hash, /^md5:/);
    assert.match(entry.downloadUrl, /\/attachments\//);
  }
});

test('live: downloaded manifest resource bytes match the advertised md5', { skip }, async () => {
  const client = makeClient();
  const entries = await client.getFormManifest({ formId: ODK_CENTRAL_FORM_ID });
  if (entries.length === 0) {
    return; // form has no attachments; nothing to verify
  }
  const entry = entries[0];
  const response = await client.downloadFormAttachment({
    formId: ODK_CENTRAL_FORM_ID,
    filename: entry.filename,
  });
  assert.equal(response.status, 200);
  const bytes = await response.arrayBuffer();
  assert.equal(`md5:${md5Hex(bytes)}`, entry.hash, 'downloaded bytes must match manifest hash');
});
