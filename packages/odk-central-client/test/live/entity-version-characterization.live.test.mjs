import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createAppUserAuth, createSessionAuth } from '../../src/auth.js';

/**
 * Opt-in LIVE M4.7.4 characterization: form-driven Entity update metadata
 * fields (`version`, `baseVersion`, `branchId`, `trunkVersion`,
 * `branchBaseVersion`, `conflictingProperties`, top-level `conflict`).
 *
 * This does one ordinary online observation-style update through xforms-engine +
 * OpenRosa submission, then inspects the resulting Entity metadata.
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_APP_USER_TOKEN
 *   ODK_CENTRAL_EMAIL, ODK_CENTRAL_PASSWORD
 *   ODK_CENTRAL_ENTITY_FORM_ID (optional, default "silphium_flower_survey_entities")
 *   ODK_CENTRAL_DATASET (optional, default "plants")
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_APP_USER_TOKEN,
  ODK_CENTRAL_EMAIL,
  ODK_CENTRAL_PASSWORD,
  ODK_CENTRAL_ENTITY_FORM_ID,
  ODK_CENTRAL_DATASET,
} = process.env;

const DATASET = ODK_CENTRAL_DATASET || 'plants';
const FORM_ID = ODK_CENTRAL_ENTITY_FORM_ID || 'silphium_flower_survey_entities';
const LIVE = Boolean(
  ODK_CENTRAL_URL &&
  ODK_CENTRAL_PROJECT_ID &&
  ODK_CENTRAL_APP_USER_TOKEN &&
  ODK_CENTRAL_EMAIL &&
  ODK_CENTRAL_PASSWORD
);
const skip = LIVE ? false : 'live env not configured (needs App User + Web User credentials)';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');

const appUserClient = () =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createAppUserAuth(ODK_CENTRAL_APP_USER_TOKEN),
    timeoutMs: 45000,
  });

const webUserClient = () =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createSessionAuth({ email: ODK_CENTRAL_EMAIL, password: ODK_CENTRAL_PASSWORD }),
    timeoutMs: 45000,
  });

const parseCsv = (text) => {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const keys = header.split(',');
  return lines
    .filter((line) => line.length > 0)
    .map((line) => Object.fromEntries(keys.map((key, index) => [key, line.split(',')[index] ?? ''])));
};

const flatten = (node, acc = []) => {
  acc.push(node);
  for (const child of node.currentState?.children ?? []) flatten(child, acc);
  return acc;
};

const byRef = (root, ref) => flatten(root).find((node) => node.currentState?.reference === ref) ?? null;

const setValue = (root, ref, value) => {
  const node = byRef(root, ref);
  if (node == null) throw new Error(`node not found for ${ref}`);
  if (typeof node.selectValue === 'function' && node.currentState?.valueOptions) {
    node.selectValue(String(value));
  } else {
    node.setValue(String(value));
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPostSubmitEntityState = async ({ client, dataset, uuid, baselineVersion, timeoutMs = 8000, intervalMs = 500 }) => {
  const deadline = Date.now() + timeoutMs;
  let latest = await client.getEntity({ name: dataset, uuid });
  while (latest.currentVersion.version <= baselineVersion && Date.now() < deadline) {
    await sleep(intervalMs);
    latest = await client.getEntity({ name: dataset, uuid });
  }
  return latest;
};

const buildObservationUpdateXml = async ({ formXml, csvText, selectedUuid, nextStatus }) => {
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

    const rows = parseCsv(csvText);
    const target = rows.find((row) => row.name === selectedUuid);
    if (target == null) throw new Error('plants.csv is empty');

    const { loadForm } = await import('@getodk/xforms-engine');
    const loaded = await loadForm(formXml, { fetchFormAttachment });
    if (loaded.status === 'failure') {
      throw new Error(`xforms-engine failed to load: ${String(loaded.error?.message ?? loaded.error)}`);
    }
    const instance = await loaded.createInstance();
    const root = instance.root;

    setValue(root, '/data/plant', target.name);
    setValue(root, '/data/plant_status', nextStatus);
    setValue(root, '/data/flower_head_count', 7);
    setValue(root, '/data/plant_height_cm', 12.5);

    const payload = await root.prepareInstancePayload();
    const xml = await payload.data[0].get('xml_submission_file').text();
    return {
      selectedUuid,
      nextStatus,
      baseVersionFromCsv: Number(target.__version),
      xml,
    };
  } finally {
    dom.restore();
  }
};

test('live: form-driven update characterizes version/conflict metadata fields', { skip }, async () => {
  const appUser = appUserClient();
  const webUser = webUserClient();

  const manifest = await appUser.getFormManifest({ formId: FORM_ID });
  const entityList = manifest.find((entry) => entry.isEntityList);
  assert.ok(entityList, 'expected entityList resource in form manifest');

  const [formXml, csvText] = await Promise.all([
    appUser.downloadForm({ formId: FORM_ID }),
    appUser.downloadFormAttachment({ formId: FORM_ID, filename: entityList.filename }).then((response) => response.text()),
  ]);

  const csvRows = parseCsv(csvText);
  const target = csvRows[csvRows.length - 1] ?? csvRows[0];
  assert.ok(target, 'expected at least one row in linked plants.csv');

  const selectedUuid = target.name;
  const before = await webUser.getEntity({ name: DATASET, uuid: selectedUuid });
  const beforeVersion = before.currentVersion.version;
  const beforeStatus = before.currentVersion.data.status;
  const nextStatus = beforeStatus === 'active' ? 'missing' : 'active';
  const generated = await buildObservationUpdateXml({ formXml, csvText, selectedUuid, nextStatus });
  assert.equal(beforeVersion, generated.baseVersionFromCsv, 'form CSV baseVersion should match current entity version before submit');

  let afterVersion = null;
  try {
    const submitResult = await appUser.submit({ xml: generated.xml });
    assert.equal(submitResult.status, 201);

    const after = await waitForPostSubmitEntityState({
      client: webUser,
      dataset: DATASET,
      uuid: generated.selectedUuid,
      baselineVersion: beforeVersion,
    });
    const cv = after.currentVersion;
    afterVersion = cv.version;

    assert.equal(cv.version, beforeVersion + 1);
    assert.equal(cv.baseVersion, beforeVersion);
    assert.equal(cv.data.status, generated.nextStatus);
    assert.ok(cv.branchId == null || typeof cv.branchId === 'string');
    assert.ok(cv.trunkVersion == null || Number.isInteger(cv.trunkVersion));
    assert.ok(cv.branchBaseVersion == null || Number.isInteger(cv.branchBaseVersion));
    assert.ok(cv.conflictingProperties == null || Array.isArray(cv.conflictingProperties));
    assert.ok(after.conflict == null || after.conflict === 'soft' || after.conflict === 'hard');

    const onlinePathShape =
      cv.branchId == null &&
      cv.trunkVersion == null &&
      cv.branchBaseVersion == null &&
      cv.conflictingProperties == null &&
      after.conflict == null;

    console.log(`M474_LIVE_RESULT::${JSON.stringify({
      dataset: DATASET,
      formId: FORM_ID,
      selectedUuid: generated.selectedUuid,
      before: {
        version: beforeVersion,
        status: beforeStatus,
      },
      after: {
        version: cv.version,
        baseVersion: cv.baseVersion,
        branchId: cv.branchId,
        trunkVersion: cv.trunkVersion,
        branchBaseVersion: cv.branchBaseVersion,
        conflictingProperties: cv.conflictingProperties,
        conflict: after.conflict,
        status: cv.data.status,
      },
      characterization: {
        onlinePathShape,
        interpretation: onlinePathShape
          ? 'ordinary online update shape (no branch/conflict fields active)'
          : 'branch/conflict fields are active for this Entity version (conflict lineage present)',
      },
    }, null, 2)}`);
  } finally {
    if (afterVersion != null) {
      const restored = await webUser.updateEntity({
        name: DATASET,
        uuid: generated.selectedUuid,
        baseVersion: afterVersion,
        data: { status: beforeStatus },
      });
      assert.equal(restored.currentVersion.data.status, beforeStatus);
    }
  }
});
