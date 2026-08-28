import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createAppUserAuth } from '../../src/auth.js';

/**
 * Opt-in LIVE M4.6.3 tests: the App User / OpenRosa **dynamic Entity resource**
 * path. READ-ONLY. SKIPPED unless env is present.
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_APP_USER_TOKEN
 *   ODK_CENTRAL_ENTITY_FORM_ID (optional, default "silphium_flower_survey_entities")
 *
 * Proves: App User -> formList -> Entity-aware form -> manifest -> plants.csv,
 * with the linked Entity List (`type="entityList"` + integrityUrl) and the static
 * media (`silphium-reference.jpg`) coexisting and both downloadable via the same
 * `downloadFormAttachment` API (md5-verified).
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_APP_USER_TOKEN,
  ODK_CENTRAL_ENTITY_FORM_ID,
} = process.env;

const FORM_ID = ODK_CENTRAL_ENTITY_FORM_ID || 'silphium_flower_survey_entities';
const LIVE = Boolean(ODK_CENTRAL_URL && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_APP_USER_TOKEN);
const skip = LIVE ? false : 'live env not configured (set ODK_CENTRAL_URL/PROJECT_ID/APP_USER_TOKEN to run)';

const appUserClient = () =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createAppUserAuth(ODK_CENTRAL_APP_USER_TOKEN),
    timeoutMs: 30000,
  });

const md5Hex = (buffer) => createHash('md5').update(Buffer.from(buffer)).digest('hex');

test('live: App User formList advertises the Entity-aware form with a manifestUrl', { skip }, async () => {
  const forms = await appUserClient().listForms();
  const form = forms.find((f) => f.formId === FORM_ID);
  assert.ok(form, `expected ${FORM_ID} in the App User form list`);
  assert.match(form.manifestUrl, /\/manifest$/);
});

test('live: manifest exposes a linked entityList (plants.csv) alongside static media', { skip }, async () => {
  const entries = await appUserClient().getFormManifest({ formId: FORM_ID });

  const entityList = entries.filter((e) => e.isEntityList);
  assert.equal(entityList.length, 1, 'exactly one linked Entity List expected');
  const csv = entityList[0];
  assert.equal(csv.type, 'entityList');
  assert.match(csv.filename, /\.csv$/);
  assert.match(csv.hash, /^md5:/);
  assert.match(csv.downloadUrl, /\/attachments\//);
  // The Entity List carries an integrityUrl pointing at the Dataset; static media does not.
  assert.match(csv.integrityUrl, /\/datasets\/.+\/integrity$/);

  const staticMedia = entries.filter((e) => !e.isEntityList);
  assert.ok(staticMedia.length >= 1, 'expected the static silphium-reference.jpg to coexist');
  for (const media of staticMedia) {
    assert.equal(media.type, null);
    assert.equal(media.integrityUrl, null);
  }
});

test('live: App User downloads plants.csv via the same attachment API', { skip }, async () => {
  const client = appUserClient();
  const entries = await client.getFormManifest({ formId: FORM_ID });
  const csv = entries.find((e) => e.isEntityList);
  assert.ok(csv, 'expected an entityList entry');

  const response = await client.downloadFormAttachment({ formId: FORM_ID, filename: csv.filename });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/csv/);
  const bytes = await response.arrayBuffer();

  // Field-client Entity List CSV shape: name(=Entity UUID), label, __version, then properties.
  const header = Buffer.from(bytes).toString('utf-8').split('\n', 1)[0];
  assert.match(header, /^name,label,__version/);

  // FINDING (M4.6.3): for an entityList the manifest <hash> is a *dataset content
  // signature* (a change-detection token, echoed as the response ETag) — NOT an
  // md5 of the delivered CSV bytes. This differs from static media, whose hash IS
  // md5(bytes). So callers must treat the entityList hash as a version token
  // (refetch when it changes) rather than a byte checksum, and use integrityUrl
  // for Entity-level integrity.
  const etag = (response.headers.get('etag') || '').replace(/^W\//, '').replace(/"/g, '');
  assert.equal(csv.hash, `md5:${etag}`, 'entityList manifest hash matches the content-signature ETag');
  assert.notEqual(`md5:${md5Hex(bytes)}`, csv.hash, 'entityList hash is a content signature, not md5(bytes)');
});

test('live: the static image also downloads via the same API, md5 verified', { skip }, async () => {
  const client = appUserClient();
  const entries = await client.getFormManifest({ formId: FORM_ID });
  const media = entries.find((e) => !e.isEntityList);
  if (media == null) return; // form may carry only the Entity List
  const response = await client.downloadFormAttachment({ formId: FORM_ID, filename: media.filename });
  assert.equal(response.status, 200);
  const bytes = await response.arrayBuffer();
  assert.equal(`md5:${md5Hex(bytes)}`, media.hash, 'downloaded media bytes must match manifest hash');
});
