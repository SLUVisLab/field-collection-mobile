import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bytesToBase64,
  createFormCatalogService,
  entityDatasetFromIntegrityUrl,
  sanitizeManifest,
  isTextResource,
} from '../../src/forms/formCatalogService.js';

const project = {
  projectKey: 'project-1',
  baseUrl: 'https://central.example',
  centralProjectId: 1,
};

// A real filesystem stores bytes and decodes on readText; the fake used to hand
// back whatever it was given, which hid the difference between the two writers.
const makeFiles = () => {
  const content = new Map();
  const decoder = new TextDecoder();
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
      const value = content.get(key);
      return value instanceof Uint8Array ? decoder.decode(value) : value;
    },
    async readBytes(key) {
      const value = content.get(key);
      return typeof value === 'string' ? new TextEncoder().encode(value) : value;
    },
    fileForKey(key) {
      return { exists: content.has(key) };
    },
  };
};

const makeForms = () => {
  const byIdentity = new Map();
  // The content-addressed resource cache: blobs keyed by OUR digest of the
  // bytes, and every (form, filename, server validator) we have already seen.
  const blobs = new Map();
  const byValidator = new Map();
  let current = null;
  const identity = ({ formKey, sourceVersion, sourceHash, manifestFingerprint }) =>
    JSON.stringify([formKey, sourceVersion, sourceHash, manifestFingerprint]);
  return {
    byIdentity,
    promotions: [],
    async listForms() {
      return [];
    },
    blobs,
    async findVersion(input) {
      return byIdentity.get(identity(input)) ?? null;
    },
    async findResourceByValidator({ projectKey, formId, filename, resourceHash }) {
      if (!resourceHash) return null;
      return byValidator.get(JSON.stringify([projectKey, formId, filename, resourceHash])) ?? null;
    },
    async getResourceBlob(digest) {
      return blobs.get(digest) ?? null;
    },
    async recordResourceBlob({ digest, byteLength, fileKey }) {
      blobs.set(digest, { digest, byteLength, fileKey });
      return blobs.get(digest);
    },
    async listReferencedBlobDigests() {
      return [
        ...new Set(
          [...byIdentity.values()].flatMap((version) =>
            (version.resources ?? []).map((resource) => resource.blobDigest).filter(Boolean)
          )
        ),
      ];
    },
    async listResourceBlobs() {
      return [...blobs.values()];
    },
    async deleteResourceBlob(digest) {
      blobs.delete(digest);
      return { digest };
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
      for (const resource of input.resources ?? []) {
        if (!resource.hash || !resource.blobDigest) continue;
        byValidator.set(
          JSON.stringify([input.projectKey, input.formId, resource.filename, resource.hash]),
          resource
        );
      }
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
  // Resource payloads are stored as bytes under their content digest now, so
  // the cached CSV has to be decoded to be inspected.
  const csvKey = [...files.content.keys()].find((key) => key.includes('/resources/blobs/'));
  const storedCsv = await files.readText(csvKey);

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
  const firstBlobs = new Set(forms.blobs.keys());
  client.calls.length = 0;
  client.entityListToken = 'dataset-token-2';

  const refreshed = await service.refresh(project);
  assert.equal(refreshed.refreshed[0].cached, false);
  assert.equal(forms.byIdentity.size, 2, 'the new resource token produces a new version identity');
  assert.ok(firstKeys.every((key) => files.content.has(key)), 'first version remains available for drafts');

  // reference.jpg's validator did not change, so it is not fetched at all —
  // the OpenRosa caching rule, applied per media file.
  assert.ok(
    !client.calls.includes('downloadFormAttachment:silphium:reference.jpg'),
    'an unchanged validator means no download'
  );
  // plants.csv's validator DID change, so the spec requires a re-fetch. Central
  // derives a Dataset attachment's hash from the dataset timestamp, so the
  // bytes can be identical anyway — and then we decline to store a second copy.
  assert.ok(
    client.calls.includes('downloadFormAttachment:silphium:plants.csv'),
    'a changed validator is honoured with a re-fetch'
  );
  assert.deepEqual(
    new Set(forms.blobs.keys()),
    firstBlobs,
    'identical bytes produce no new blob, however much the validator churned'
  );
  // Only the version-specific files (form.xml, manifest.json) are new.
  assert.equal(files.content.size, firstKeys.length + 2, 'no resource payload was duplicated');
});

test('binary attachment base64 encoding is runtime-neutral', () => {
  assert.equal(bytesToBase64(new Uint8Array([0, 1, 2, 255])), 'AAEC/w==');
});

test('a composition artifact Central serves as octet-stream is still cached as text', () => {
  // Central classifies anything declared through an itext media value as
  // `image` and serves it `application/octet-stream` — verified live against
  // v2026.2.4 by the packaging gate. Trusting the content type alone let the
  // artifact download intact, cache as bytes, and then reach the composition
  // loader with no `text`, which reported it as "present but empty".
  assert.equal(
    isTextResource({ filename: 'authored_photo_v1.a2ui.json', contentType: 'application/octet-stream' }),
    true
  );
  assert.equal(isTextResource({ filename: 'plants.csv', contentType: 'application/octet-stream' }), true);
  assert.equal(isTextResource({ filename: 'notes.txt', contentType: 'application/octet-stream' }), true);

  // A helpful content type still works on its own, filename or not.
  assert.equal(isTextResource({ filename: 'blob', contentType: 'text/csv' }), true);
  assert.equal(isTextResource({ filename: 'blob', contentType: 'application/json' }), true);

  // Genuine binaries stay binary — including the opaque bundle format, which
  // the composition loader decodes rather than the cache guessing.
  assert.equal(isTextResource({ filename: 'logo.png', contentType: 'image/png' }), false);
  assert.equal(isTextResource({ filename: 'u2netp.onnx', contentType: 'application/octet-stream' }), false);
  assert.equal(isTextResource({ filename: 'flower_v1.gather', contentType: 'application/octet-stream' }), false);
});
