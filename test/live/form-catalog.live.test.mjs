import test from 'node:test';
import assert from 'node:assert/strict';

import { OdkCentralClient, createAppUserAuth } from 'odk-central-client';
import { sanitizeManifest } from '../../src/forms/formCatalogService.js';

const { ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_APP_USER_TOKEN, ODK_CENTRAL_ENTITY_FORM_ID } =
  process.env;
const live = Boolean(ODK_CENTRAL_URL && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_APP_USER_TOKEN);
const skip = live ? false : 'live env not configured (set ODK_CENTRAL_URL/PROJECT_ID/APP_USER_TOKEN)';

test('live: App User catalog downloads an Entity List only through public OpenRosa APIs', { skip }, async () => {
  const client = new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createAppUserAuth(ODK_CENTRAL_APP_USER_TOKEN),
    timeoutMs: 45_000,
  });
  const forms = await client.listForms();
  const formId = ODK_CENTRAL_ENTITY_FORM_ID || 'silphium_flower_survey_entities';
  assert.ok(forms.some((form) => form.formId === formId), `expected ${formId} in form list`);

  const [xml, manifest] = await Promise.all([
    client.downloadForm({ formId }),
    client.getFormManifest({ formId }),
  ]);
  assert.ok(xml.includes('<h:html') || xml.includes('<html'), 'expected XForm XML');
  const resources = sanitizeManifest(manifest);
  const entityList = resources.find((resource) => resource.isEntityList);
  assert.ok(entityList, 'expected an Entity List in the App User manifest');
  const response = await client.downloadFormAttachment({ formId, filename: entityList.filename });
  const csv = await response.text();
  assert.match(csv, /^name,label,__version/m, 'expected field-client Entity List CSV');

  console.log(
    `M53_CATALOG_LIVE_RESULT::${JSON.stringify({
      formId,
      resourceCount: resources.length,
      entityList: entityList.filename,
      csvRows: csv.trim().split(/\r?\n/).length - 1,
    })}`
  );
});
