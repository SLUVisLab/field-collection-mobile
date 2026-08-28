import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createAppUserAuth } from '../../src/auth.js';

/**
 * Opt-in LIVE M4.7.6 characterization (no implementation):
 * Does an Entity created offline in registration immediately appear in another
 * offline form without a Central sync round-trip?
 *
 * Expected for stock engine without an app-owned offline entity overlay: NO.
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_APP_USER_TOKEN
 *   ODK_CENTRAL_ENTITY_FORM_ID (optional, default "silphium_flower_survey_entities")
 *   ODK_CENTRAL_REGISTRATION_FORM_ID (optional, default "silphium_plant_registration")
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_APP_USER_TOKEN,
  ODK_CENTRAL_ENTITY_FORM_ID,
  ODK_CENTRAL_REGISTRATION_FORM_ID,
} = process.env;

const ENTITY_FORM_ID = ODK_CENTRAL_ENTITY_FORM_ID || 'silphium_flower_survey_entities';
const REGISTRATION_FORM_ID = ODK_CENTRAL_REGISTRATION_FORM_ID || 'silphium_plant_registration';
const LIVE = Boolean(ODK_CENTRAL_URL && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_APP_USER_TOKEN);
const skip = LIVE ? false : 'live env not configured (set ODK_CENTRAL_URL/PROJECT_ID/APP_USER_TOKEN)';

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

const extractEntity = (xml) => {
  const block = xml.match(/<entity\b[\s\S]*?<\/entity>|<entity\b[^>]*\/>/i)?.[0] ?? '';
  return {
    block,
    id: block.match(/\bid="([^"]*)"/i)?.[1] ?? null,
    dataset: block.match(/\bdataset="([^"]*)"/i)?.[1] ?? null,
    create: block.match(/\bcreate="([^"]*)"/i)?.[1] ?? null,
    label: block.match(/<label>([\s\S]*?)<\/label>/i)?.[1] ?? null,
  };
};

test('live: offline-created entity does not auto-appear cross-form without sync', { skip }, async () => {
  const client = appUserClient();

  // Online prefetch/cache step.
  const entityManifest = await client.getFormManifest({ formId: ENTITY_FORM_ID });
  const entityList = entityManifest.find((entry) => entry.isEntityList);
  assert.ok(entityList, 'expected linked entityList resource on observation form');

  const [registrationXml, observationXml, plantsCsv] = await Promise.all([
    client.downloadForm({ formId: REGISTRATION_FORM_ID }),
    client.downloadForm({ formId: ENTITY_FORM_ID }),
    client.downloadFormAttachment({ formId: ENTITY_FORM_ID, filename: entityList.filename }).then((response) => response.text()),
  ]);

  const cachedRows = parseCsv(plantsCsv);
  assert.ok(cachedRows.length > 0, 'expected cached plants.csv rows');
  const baselineChoiceCount = cachedRows.length;

  // Offline characterization: we only serve cached resources in-process.
  const cache = new Map([[entityList.filename, plantsCsv]]);
  const fetchFormAttachment = async (resourceUrl) => {
    const href = typeof resourceUrl === 'string' ? resourceUrl : resourceUrl?.href ?? String(resourceUrl);
    const filename = decodeURIComponent(href.split('/').pop() ?? '');
    const text = cache.get(filename);
    if (text == null) return new Response(null, { status: 404 });
    return new Response(text, { status: 200, headers: { 'content-type': 'text/csv' } });
  };

  const { installSlimdomDomCompatibility } = require(
    join(repoRoot, 'experiments', 'm2-slimdom-xforms', 'installDomCompatibility.js')
  );
  const dom = installSlimdomDomCompatibility({ force: true });
  try {
    const engineDistDir = join(repoRoot, 'node_modules', '@getodk', 'xforms-engine', 'dist');
    globalThis.__dirname = engineDistDir;
    globalThis.__filename = join(engineDistDir, 'index.js');
    if (typeof globalThis.require !== 'function') globalThis.require = require;

    const { loadForm } = await import('@getodk/xforms-engine');

    // Step A: create a brand-new Entity locally (registration) and serialize only.
    const registration = await loadForm(registrationXml);
    if (registration.status === 'failure') {
      throw new Error(`registration form failed to load: ${String(registration.error?.message ?? registration.error)}`);
    }
    const regInstance = await registration.createInstance();
    const regRoot = regInstance.root;

    const site = `M47OFF-${randomUUID().slice(0, 8)}`;
    setValue(regRoot, '/data/field_site', site);
    setValue(regRoot, '/data/block', '9');
    setValue(regRoot, '/data/column', '9');
    setValue(regRoot, '/data/row', '9');
    setValue(regRoot, '/data/plant_location', '38.5200 -90.5500 0 5');
    setValue(regRoot, '/data/status', 'active');

    const regPayload = await regRoot.prepareInstancePayload();
    const registrationSubmissionXml = await regPayload.data[0].get('xml_submission_file').text();
    const createdEntity = extractEntity(registrationSubmissionXml);
    assert.equal(createdEntity.dataset, 'plants');
    assert.equal(createdEntity.create, '1');
    assert.ok(createdEntity.id, 'registration serialization should include a local Entity uuid');

    // Step B: offline observation form still uses only cached plants.csv.
    const observation = await loadForm(observationXml, { fetchFormAttachment });
    if (observation.status === 'failure') {
      throw new Error(`observation form failed to load: ${String(observation.error?.message ?? observation.error)}`);
    }
    const obsInstance = await observation.createInstance();
    const obsRoot = obsInstance.root;
    const choices = byRef(obsRoot, '/data/plant')?.currentState?.valueOptions ?? [];

    const choiceValues = choices.map((choice) =>
      typeof choice === 'string' ? choice : `${choice?.value ?? ''}`
    );
    const appearsByUuid = choiceValues.includes(createdEntity.id);
    const appearsByLabel =
      createdEntity.label != null &&
      choices.some((choice) => `${typeof choice === 'string' ? choice : choice?.label ?? ''}` === createdEntity.label);

    assert.equal(choices.length, baselineChoiceCount, 'offline choices should match cached CSV rows only');
    assert.equal(appearsByUuid, false, 'offline-created Entity uuid should not appear without sync');
    assert.equal(appearsByLabel, false, 'offline-created Entity label should not appear without sync');

    console.log(`M476_LIVE_RESULT::${JSON.stringify({
      scope: 'characterization only (no offline store implementation)',
      registrationFormId: REGISTRATION_FORM_ID,
      observationFormId: ENTITY_FORM_ID,
      cachedRowCount: baselineChoiceCount,
      offlineChoiceCount: choices.length,
      offlineCreatedEntity: {
        uuid: createdEntity.id,
        label: createdEntity.label,
        dataset: createdEntity.dataset,
      },
      appearsInObservationChoicesWithoutSync: appearsByUuid || appearsByLabel,
      conclusion:
        'No cross-form propagation without a host-managed offline Entity overlay/sync path.',
    }, null, 2)}`);
  } finally {
    dom.restore();
  }
});
