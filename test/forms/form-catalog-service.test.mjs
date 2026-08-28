import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bytesToBase64,
  createFormCatalogService,
  entityDatasetFromIntegrityUrl,
  sanitizeManifest,
} from '../../src/forms/formCatalogService.js';

const project = {
  projectKey: 'project-1',
  baseUrl: 'https://central.example',
  centralProjectId: 1,
};

const makeFiles = () => {
  const content = new Map();
  return {
    content,
    async writeTextAtomic(key, value) {
      content.set(key, value);
      return key;
    },
    async writeBytesAtomic(key, value) {
      content.set(key, value);
      return key;
    },
    async readText(key) {
      return content.get(key);
    },
    async readBytes(key) {
      return content.get(key);
    },
  };
};

const makeForms = () => {
  const byIdentity = new Map();
  let current = null;
  const identity = ({ formKey, sourceVersion, sourceHash, manifestFingerprint }) =>
    JSON.stringify([formKey, sourceVersion, sourceHash, manifestFingerprint]);
  return {
    byIdentity,
    promotions: [],
    async listForms() {
      return [];
    },
    async findVersion(input) {
      return byIdentity.get(identity(input)) ?? null;
    },
    async recordCachedVersion(input) {
      const formVersionId = identity({
        formKey: JSON.stringify([input.projectKey, input.formId]),
        sourceVersion: input.sourceVersion,
        sourceHash: input.sourceHash,
        manifestFingerprint: input.manifestFingerprint,
      });
      const version = {
        formVersionId,
        formId: input.formId,
        displayName: input.displayName,
        sourceVersion: input.sourceVersion,
        xmlFileKey: input.xmlFileKey,
        manifestFileKey: input.manifestFileKey,
        resources: input.resources,
      };
      byIdentity.set(formVersionId, version);
      current = version;
      return version;
    },
    async promoteVersion(input) {
      this.promotions.push(input);
      current = [...byIdentity.values()].find((version) => version.formVersionId === input.formVersionId);
      return current;
    },
    async getCurrentVersion() {
      return current;
    },
    async getVersion(formVersionId) {
      return [...byIdentity.values()].find((version) => version.formVersionId === formVersionId) ?? null;
    },
  };
};

const makeClient = () => {
  const calls = [];
  return {
    calls,
    entityListToken: 'dataset-token-1',
    async listForms() {
      calls.push('listForms');
      return [{ formId: 'silphium', name: 'Silphium', version: '1', hash: 'md5:form-v1' }];
    },
    async getFormManifest({ formId }) {
      calls.push(`getFormManifest:${formId}`);
      return [
        {
          filename: 'plants.csv',
          hash: this.entityListToken,
          type: 'entityList',
          isEntityList: true,
          integrityUrl: 'https://central.example/v1/key/secret/projects/1/datasets/plants/integrity',
          downloadUrl: 'https://central.example/v1/key/secret/plants.csv',
        },
        {
          filename: 'reference.jpg',
          hash: 'md5:media-v1',
          type: null,
          isEntityList: false,
          downloadUrl: 'https://central.example/v1/key/secret/reference.jpg',
        },
      ];
    },
    async downloadForm({ formId }) {
      calls.push(`downloadForm:${formId}`);
      return '<xml id="silphium" />';
    },
    async downloadFormAttachment({ formId, filename }) {
      calls.push(`downloadFormAttachment:${formId}:${filename}`);
      if (filename === 'plants.csv') {
        return new Response('name,label,__version\nplant-1,Plant 1,1\n', {
          headers: { 'content-type': 'text/csv' },
        });
      }
      return new Response(new Uint8Array([0, 1, 2]), {
        headers: { 'content-type': 'image/jpeg' },
      });
    },
  };
};

test('sanitized manifest strips App User key URLs', () => {
  const sanitized = sanitizeManifest([
    {
      filename: 'plants.csv',
      hash: 'token',
      isEntityList: true,
      downloadUrl: 'https://server/v1/key/secret/plants.csv',
      integrityUrl: 'https://server/v1/key/secret/projects/1/datasets/plants/integrity',
    },
  ]);
  assert.deepEqual(sanitized, [
    {
      filename: 'plants.csv',
      hash: 'token',
      type: null,
      isEntityList: true,
      entityDataset: 'plants',
    },
  ]);
});

test('Entity Dataset identity is recovered from transient manifest metadata without retaining its URL', () => {
  assert.equal(
    entityDatasetFromIntegrityUrl('https://central.example/v1/key/secret/projects/1/datasets/people%20list/integrity'),
    'people list'
  );
  assert.equal(entityDatasetFromIntegrityUrl('https://central.example/not-a-dataset'), null);
});

test('explicit refresh caches XML, sanitized manifest, and Entity CSV through durable keys', async () => {
  const files = makeFiles();
  const forms = makeForms();
  const client = makeClient();
  const service = createFormCatalogService({
    forms,
    credentials: { getProjectToken: async () => 'secret' },
    files,
    entities: { synthesizeAttachments: async ({ attachments }) => attachments },
    createClient: () => client,
  });

  const result = await service.refresh(project);
  assert.deepEqual(result.failures, []);
  assert.equal(result.refreshed[0].cached, false);
  assert.deepEqual(client.calls, [
    'listForms',
    'getFormManifest:silphium',
    'downloadForm:silphium',
    'downloadFormAttachment:silphium:plants.csv',
    'downloadFormAttachment:silphium:reference.jpg',
  ]);
  const writes = [...files.content.entries()];
  assert.equal(writes.length, 4, 'form XML, manifest, CSV, and image are durable writes');
  assert.ok(writes.every(([key]) => key.startsWith('projects/project-1/')));
  assert.ok(writes.every(([key, value]) => !String(value).includes('/v1/key/secret/')));

  const loaded = await service.loadCurrentForm(project.projectKey, 'silphium');
  const csv = loaded.attachments.find((attachment) => attachment.filename === 'plants.csv');
  const image = loaded.attachments.find((attachment) => attachment.filename === 'reference.jpg');
  assert.match(csv.text, /^name,label,__version/);
  assert.equal(image.base64, 'AAEC');
});

test('repeated refresh does not download or overwrite an existing immutable version', async () => {
  const files = makeFiles();
  const forms = makeForms();
  const client = makeClient();
  const service = createFormCatalogService({
    forms,
    credentials: { getProjectToken: async () => 'secret' },
    files,
    entities: { synthesizeAttachments: async ({ attachments }) => attachments },
    createClient: () => client,
  });
  await service.refresh(project);
  const writesAfterFirst = files.content.size;
  client.calls.length = 0;

  const second = await service.refresh(project);
  assert.equal(second.refreshed[0].cached, true);
  assert.deepEqual(client.calls, ['listForms', 'getFormManifest:silphium']);
  assert.equal(files.content.size, writesAfterFirst, 'existing immutable files were not overwritten');
  assert.equal(forms.promotions.length, 1);
});

test('loading a form synthesizes Entity CSV only in the host attachment, not the immutable cache', async () => {
  const files = makeFiles();
  const forms = makeForms();
  const client = makeClient();
  const entityCalls = [];
  const service = createFormCatalogService({
    forms,
    credentials: { getProjectToken: async () => 'secret' },
    files,
    entities: {
      async synthesizeAttachments(input) {
        entityCalls.push(input);
        return input.attachments.map((attachment) =>
          attachment.filename === 'plants.csv' ? { ...attachment, text: `${attachment.text}local-overlay\n` } : attachment
        );
      },
    },
    createClient: () => client,
  });
  await service.refresh(project);
  const storedCsv = [...files.content.entries()].find(([key]) => key.includes('/resources/') && files.content.get(key).includes('__version'))[1];

  const loaded = await service.loadCurrentForm(project.projectKey, 'silphium');
  assert.match(loaded.attachments.find((attachment) => attachment.filename === 'plants.csv').text, /local-overlay/);
  assert.doesNotMatch(storedCsv, /local-overlay/, 'cached App User CSV stays immutable');
  assert.equal(entityCalls[0].resources.find((resource) => resource.filename === 'plants.csv').entityDataset, 'plants');
});

test('a changed Entity List token creates a new immutable cache version', async () => {
  const files = makeFiles();
  const forms = makeForms();
  const client = makeClient();
  const service = createFormCatalogService({
    forms,
    credentials: { getProjectToken: async () => 'secret' },
    files,
    entities: { synthesizeAttachments: async ({ attachments }) => attachments },
    createClient: () => client,
  });
  await service.refresh(project);
  const firstKeys = [...files.content.keys()];
  client.entityListToken = 'dataset-token-2';

  const refreshed = await service.refresh(project);
  assert.equal(refreshed.refreshed[0].cached, false);
  assert.equal(forms.byIdentity.size, 2, 'the new resource token produces a new version identity');
  assert.equal(files.content.size, firstKeys.length * 2, 'new files do not overwrite first-version keys');
  assert.ok(firstKeys.every((key) => files.content.has(key)), 'first version remains available for drafts');
});

test('binary attachment base64 encoding is runtime-neutral', () => {
  assert.equal(bytesToBase64(new Uint8Array([0, 1, 2, 255])), 'AAEC/w==');
});
