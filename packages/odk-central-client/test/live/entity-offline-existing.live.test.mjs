import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createAppUserAuth } from '../../src/auth.js';

/**
 * Opt-in LIVE M4.7.5 gate: prove the easy offline case for *existing* Entities.
 *
 * Flow:
 * 1) Online: fetch form XML + linked plants.csv through App User/OpenRosa path.
 * 2) Offline characterization: load/operate/serialize with only locally cached
 *    resources in memory (no network submission).
 *
 * This intentionally characterizes the in-process cached-resource behavior; it
 * does not build an Offline Store/Sync Manager.
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_APP_USER_TOKEN
 *   ODK_CENTRAL_ENTITY_FORM_ID (optional, default "silphium_flower_survey_entities")
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_APP_USER_TOKEN,
  ODK_CENTRAL_ENTITY_FORM_ID,
} = process.env;

const FORM_ID = ODK_CENTRAL_ENTITY_FORM_ID || 'silphium_flower_survey_entities';
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

const leaf = (root, ref) => {
  const value = byRef(root, ref)?.currentState?.value;
  if (Array.isArray(value)) return value.map(String).join(' ');
  if (value == null) return null;
  return String(value);
};

const extractEntity = (xml) => {
  const block = xml.match(/<entity\b[^>]*\/?>(?:[\s\S]*?<\/entity>)?/i)?.[0] ?? '';
  return {
    block,
    id: block.match(/\bid="([^"]*)"/i)?.[1] ?? null,
    update: block.match(/\bupdate="([^"]*)"/i)?.[1] ?? null,
    baseVersion: block.match(/\bbaseVersion="([^"]*)"/i)?.[1] ?? null,
  };
};

test('live: existing entity remains usable offline with cached form/resources', { skip }, async () => {
  const client = appUserClient();
  const forms = await client.listForms();
  assert.ok(forms.some((form) => form.formId === FORM_ID), `expected ${FORM_ID} in App User form list`);

  const manifest = await client.getFormManifest({ formId: FORM_ID });
  const entityList = manifest.find((entry) => entry.isEntityList);
  assert.ok(entityList, 'expected linked entityList resource');

  const [formXml, csvText] = await Promise.all([
    client.downloadForm({ formId: FORM_ID }),
    client.downloadFormAttachment({ formId: FORM_ID, filename: entityList.filename }).then((response) => response.text()),
  ]);

  // --- Offline characterization (in-process cache only) ---
  const cache = new Map([['plants.csv', csvText]]);
  let cacheHits = 0;
  const fetchFormAttachment = async (resourceUrl) => {
    const href = typeof resourceUrl === 'string' ? resourceUrl : resourceUrl?.href ?? String(resourceUrl);
    const filename = decodeURIComponent(href.split('/').pop() ?? '');
    const text = cache.get(filename);
    if (text == null) return new Response(null, { status: 404 });
    cacheHits += 1;
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
    const loaded = await loadForm(formXml, { fetchFormAttachment });
    if (loaded.status === 'failure') {
      throw new Error(`xforms-engine failed to load: ${String(loaded.error?.message ?? loaded.error)}`);
    }
    const instance = await loaded.createInstance();
    const root = instance.root;
    const rows = parseCsv(csvText);
    const target = rows[rows.length - 1] ?? rows[0];
    assert.ok(target, 'expected at least one Entity row in cached plants.csv');

    const selectNode = byRef(root, '/data/plant');
    const choices = selectNode?.currentState?.valueOptions ?? [];
    const newStatus = target.status === 'active' ? 'missing' : 'active';

    setValue(root, '/data/plant', target.name);
    setValue(root, '/data/plant_status', newStatus);
    setValue(root, '/data/flower_head_count', 7);
    setValue(root, '/data/plant_height_cm', 12.5);

    const payload = await root.prepareInstancePayload();
    const xml = await payload.data[0].get('xml_submission_file').text();
    const entity = extractEntity(xml);

    const checks = {
      choicesMaterialized: choices.length === rows.length && rows.length > 0,
      selectedUuidMatchesCsv: leaf(root, '/data/plant') === target.name,
      derivedSiteMatchesCsv: leaf(root, '/data/field_site') === target.site,
      derivedBlockMatchesCsv: leaf(root, '/data/block') === target.block,
      entityUpdateBlockPresent: entity.update === '1' && entity.id === target.name,
      baseVersionFromCachedCsv: entity.baseVersion === target.__version,
      serializeContainsObservation:
        /<flower_head_count>7<\/flower_head_count>/.test(xml) &&
        /<plant_height_cm>12\.5<\/plant_height_cm>/.test(xml),
    };
    assert.ok(Object.values(checks).every(Boolean), 'offline cached-resource checks must all pass');

    console.log(`M475_LIVE_RESULT::${JSON.stringify({
      scope: 'in-process cached-resource characterization',
      formId: FORM_ID,
      selectedUuid: target.name,
      cachedRowCount: rows.length,
      choiceCount: choices.length,
      cacheHits,
      oldStatus: target.status,
      newStatus,
      checks,
    }, null, 2)}`);
  } finally {
    dom.restore();
  }
});
