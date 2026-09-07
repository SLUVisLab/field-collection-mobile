import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createAppUserAuth, createSessionAuth } from '../../src/auth.js';

/**
 * Opt-in LIVE M4.6.5 test: **form-driven Entity creation**. A registration
 * submission (serialized from the real `silphium_plant_registration` form, kept
 * here as a placeholder template so the client package stays engine-free) is
 * submitted via the ordinary OpenRosa path; Central creates the Entity. We then
 * REST-verify the new Entity. SKIPPED unless env is present; MUTATING (creates a
 * uniquely-labeled test Entity per run) — never run in a watch loop.
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_APP_USER_TOKEN  (submit)
 *   ODK_CENTRAL_EMAIL, ODK_CENTRAL_PASSWORD                              (REST verify)
 *   ODK_CENTRAL_DATASET (optional, default "plants")
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_APP_USER_TOKEN,
  ODK_CENTRAL_EMAIL,
  ODK_CENTRAL_PASSWORD,
  ODK_CENTRAL_DATASET,
} = process.env;

const DATASET = ODK_CENTRAL_DATASET || 'plants';
const LIVE = Boolean(
  ODK_CENTRAL_URL && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_APP_USER_TOKEN && ODK_CENTRAL_EMAIL && ODK_CENTRAL_PASSWORD
);
const skip = LIVE ? false : 'live env not configured (needs App User + Web User) — mutating test';

const here = dirname(fileURLToPath(import.meta.url));
const readFixture = (name) => readFile(join(here, '..', 'fixtures', name), 'utf-8');

test('live: registration submission creates a real Entity (form-driven, REST-verified)', { skip }, async () => {
  const template = await readFixture('registration.submission.template.xml');
  const site = `M46-${randomUUID().slice(0, 8)}`;
  const entityId = randomUUID();
  const instanceId = `uuid:${randomUUID()}`;
  const xml = template
    .replaceAll('{{SITE}}', site)
    .replace('{{ENTITY_ID}}', entityId)
    .replace('{{INSTANCE_ID}}', instanceId);

  const appUser = new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createAppUserAuth(ODK_CENTRAL_APP_USER_TOKEN),
    timeoutMs: 45000,
  });
  const result = await appUser.submit({ xml });
  assert.equal(result.status, 201);
  assert.equal(result.instanceId, instanceId);

  // Verify Central created the Entity via the REST/admin surface (Web User).
  const webUser = new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createSessionAuth({ email: ODK_CENTRAL_EMAIL, password: ODK_CENTRAL_PASSWORD }),
    timeoutMs: 30000,
  });
  const entity = await webUser.getEntity({ name: DATASET, uuid: entityId });
  const cv = entity.currentVersion;
  assert.equal(cv.label, `${site}-B9-C9-R9`, 'label is the calculated plant_code');
  assert.equal(cv.version, 1, 'a freshly-created Entity is version 1');
  assert.equal(entity.conflict, null);
  // save_to properties round-trip (values are strings).
  assert.equal(cv.data.site, site);
  assert.equal(cv.data.block, '9');
  assert.equal(cv.data.column, '9');
  assert.equal(cv.data.row, '9');
  assert.equal(cv.data.plant_code, `${site}-B9-C9-R9`);
  assert.equal(cv.data.status, 'active');
  assert.match(cv.data.geometry, /^38\.5242 -90\.5582/);
});
