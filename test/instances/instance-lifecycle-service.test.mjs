import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInstanceLifecycleService,
  InstanceLifecycleError,
  sanitizeSubmissionText,
} from '../../src/instances/instanceLifecycleService.js';

const project = {
  projectKey: 'project-1',
  baseUrl: 'https://central.example',
  centralProjectId: 1,
};

const version = {
  projectKey: 'project-1',
  formId: 'plant_observation',
  formVersionId: 'immutable-version-1',
  sourceVersion: '20260828',
  sourceHash: 'md5:form-v1',
  resources: [],
};

const validXml = `<?xml version="1.0"?><data id="plant_observation"><repeat><entity>plant-uuid</entity></repeat><meta><instanceID>uuid:instance-1</instanceID></meta></data>`;
const changedXml = validXml.replace('plant-uuid', 'plant-uuid-2');

const makeFiles = (orderedCalls) => {
  const content = new Map();
  const calls = [];
  const nativeFiles = new Map();
  return {
    content,
    calls,
    async writeTextAtomic(key, text) {
      calls.push(['write', key]);
      orderedCalls.push(['write', key]);
      content.set(key, text);
      return key;
    },
    async readText(key) {
      calls.push(['read', key]);
      return content.get(key);
    },
    async writeBytesAtomic(key, bytes) {
      calls.push(['writeBytes', key]);
      orderedCalls.push(['writeBytes', key]);
      content.set(key, bytes);
      return key;
    },
    fileForKey(key) {
      if (!nativeFiles.has(key)) nativeFiles.set(key, { expoFile: true, key });
      return nativeFiles.get(key);
    },
    async deleteFile(key) {
      calls.push(['delete', key]);
      content.delete(key);
    },
  };
};

const makeInstances = (calls) => {
  const rows = new Map();
  const media = new Map();
  const clone = (row) => (row ? { ...row } : null);
  return {
    rows,
    media,
    async get(id) {
      return clone(rows.get(id));
    },
    async list(projectKey, { state = null } = {}) {
      return [...rows.values()]
        .filter((row) => row.projectKey === projectKey && (state == null || row.state === state))
        .map(clone);
    },
    async createDraft(input) {
      calls.push(['createDraft', input.localInstanceId]);
      const row = {
        ...input,
        state: 'draft',
        createdAt: 'created',
        updatedAt: 'created',
        finalizedAt: null,
        sentAt: null,
        sendReceipt: null,
        sendError: null,
      };
      rows.set(row.localInstanceId, row);
      return clone(row);
    },
    async listMedia(localInstanceId) {
      return [...media.values()]
        .filter((entry) => entry.localInstanceId === localInstanceId)
        .map((entry) => ({ ...entry }));
    },
    async upsertMedia(input) {
      calls.push(['upsertMedia', input.localInstanceId]);
      media.set(`${input.localInstanceId}:${input.bindingReference}`, { ...input });
      return { ...input };
    },
    async saveDraft({ localInstanceId, odkInstanceId }) {
      calls.push(['saveDraft', localInstanceId]);
      const row = rows.get(localInstanceId);
      if (!row || row.state !== 'draft') throw new Error('invalid draft transition');
      row.odkInstanceId = odkInstanceId;
      row.updatedAt = 'saved';
      row.sendError = null;
      return clone(row);
    },
    async markReady({ localInstanceId, odkInstanceId }) {
      calls.push(['markReady', localInstanceId]);
      const row = rows.get(localInstanceId);
      if (!row || row.state !== 'draft') throw new Error('invalid ready transition');
      row.state = 'ready';
      row.odkInstanceId = odkInstanceId;
      row.finalizedAt = row.updatedAt = 'ready';
      row.sendError = null;
      return clone(row);
    },
    async markSendFailure({ localInstanceId, sendError }) {
      calls.push(['markSendFailure', localInstanceId]);
      const row = rows.get(localInstanceId);
      if (!row || row.state !== 'ready') throw new Error('invalid retry transition');
      row.sendError = sendError;
      row.updatedAt = 'failed';
      return clone(row);
    },
    async markSent({ localInstanceId, sendReceipt }) {
      calls.push(['markSent', localInstanceId]);
      const row = rows.get(localInstanceId);
      if (!row || row.state !== 'ready') throw new Error('invalid sent transition');
      row.state = 'sent';
      row.sendReceipt = sendReceipt;
      row.sendError = null;
      row.sentAt = row.updatedAt = 'sent';
      return clone(row);
    },
    async removeDraft(id) {
      calls.push(['removeDraft', id]);
      const row = rows.get(id);
      if (!row || row.state !== 'draft') throw new Error('invalid discard transition');
      rows.delete(id);
      for (const [key, entry] of media) {
        if (entry.localInstanceId === id) media.delete(key);
      }
    },
  };
};

const makeService = ({ serialized, client, formCatalog = null, entityEffects: suppliedEntityEffects = null } = {}) => {
  const calls = [];
  const files = makeFiles(calls);
  const instances = makeInstances(calls);
  const entityEffects = suppliedEntityEffects ?? {
    calls: [],
    async recordFinalizedEffects(input) {
      this.calls.push(input);
      return input.effects;
    },
  };
  const catalog =
    formCatalog ??
    {
      calls: [],
      async loadFormVersion(formVersionId) {
        this.calls.push(formVersionId);
        return { version, xml: '<form immutable-version="1" />', attachments: [{ filename: 'plants.csv', text: 'a,b' }] };
      },
    };
  const service = createInstanceLifecycleService({
    instances,
    formCatalog: catalog,
    entityEffects,
    credentials: { getProjectToken: async () => 'app-user-secret' },
    files,
    createClient: () => client ?? { submit: async () => ({ status: 201, message: 'Accepted' }) },
    newLocalInstanceId: () => 'local-1',
  });
  return { service, instances, files, calls, catalog, entityEffects, serialized };
};

test('draft persistence writes authoritative XML before metadata and resume calls loadInstance only', async () => {
  const serialized = { status: 'success', violationCount: 3, xml: validXml };
  const { service, instances, files, calls, catalog } = makeService({ serialized });
  const form = { serialize: async () => serialized };

  const draft = await service.saveDraft({ project, form, version });
  assert.equal(draft.state, 'draft');
  assert.equal(calls[0][0], 'write');
  assert.equal(calls[1][0], 'createDraft');
  assert.equal(files.calls[0][0], 'write', 'atomic XML write happens before metadata insertion');
  assert.equal(instances.rows.get('local-1').formVersionId, version.formVersionId);
  assert.equal(files.content.get(draft.xmlFileKey), validXml);

  const resumed = { loadInstanceCalls: [], setValueCalls: 0 };
  resumed.loadInstance = async (...args) => resumed.loadInstanceCalls.push(args);
  resumed.setValue = () => {
    resumed.setValueCalls += 1;
  };
  await service.resume({ project, localInstanceId: draft.localInstanceId, form: resumed });
  assert.deepEqual(catalog.calls, [version.formVersionId]);
  assert.equal(resumed.loadInstanceCalls.length, 1);
  assert.deepEqual(resumed.loadInstanceCalls[0], [
    '<form immutable-version="1" />',
    validXml,
    [{ filename: 'plants.csv', text: 'a,b' }],
  ]);
  assert.equal(resumed.setValueCalls, 0, 'resume never replays answers through setValue');
});

test('finalization uses the engine validation result and never marks invalid XML ready', async () => {
  const invalid = { status: 'success', violationCount: 1, xml: validXml };
  const { service, instances, files } = makeService({ serialized: invalid });
  const form = { serialize: async () => invalid, getEntityEffects: async () => [] };

  await assert.rejects(service.finalize({ project, form, version }), (error) => {
    assert.equal(error instanceof InstanceLifecycleError, true);
    assert.equal(error.code, 'GATHER_INSTANCE_VALIDATION');
    return true;
  });
  assert.equal(instances.rows.size, 0);
  assert.equal(files.content.size, 0);

  const valid = { status: 'success', violationCount: 0, xml: changedXml };
  form.serialize = async () => valid;
  const ready = await service.finalize({ project, form, version });
  assert.equal(ready.state, 'ready');
  assert.equal(files.content.get(ready.xmlFileKey), changedXml);
});

test('finalization persists XML before recording only generic host Entity effects', async () => {
  let files;
  let observedXml = null;
  const entityEffects = {
    recorded: null,
    async recordFinalizedEffects(input) {
      observedXml = files.content.get('projects/project-1/instances/local-1/instance.xml');
      this.recorded = input;
      return input.effects;
    },
  };
  const serialized = { status: 'success', violationCount: 0, xml: changedXml };
  const setup = makeService({ serialized, entityEffects });
  files = setup.files;
  const engineEffects = [
    {
      reference: '/data/meta/entity',
      dataset: 'people',
      action: 'create',
      entityId: 'C',
      label: 'Created',
      properties: { full_name: 'Created Person' },
      baseVersion: null,
      trunkVersion: null,
      branchId: null,
    },
  ];
  const ready = await setup.service.finalize({
    project,
    form: {
      serialize: async () => serialized,
      getEntityEffects: async () => engineEffects,
    },
    version,
  });

  assert.equal(ready.state, 'ready');
  assert.equal(observedXml, changedXml, 'finalized XML is durable before effects are requested/applied');
  assert.deepEqual(entityEffects.recorded.effects, engineEffects);
  assert.equal(entityEffects.recorded.localInstanceId, ready.localInstanceId);
});

test('ambiguous accepted response remains retryable and retries the exact persisted XML', async () => {
  let responseLost = true;
  let acceptedXml = null;
  const client = {
    calls: [],
    async submit({ xml }) {
      this.calls.push(xml);
      if (responseLost) {
        responseLost = false;
        acceptedXml = xml;
        throw new Error(
          'Central request failed for https://central.example/v1/key/app-user-secret/submission?token=query-secret Authorization: Bearer bearer-secret'
        );
      }
      return { status: 201, message: 'accepted?api_key=receipt-secret', instanceId: 'uuid:instance-1' };
    },
  };
  const serialized = { status: 'success', violationCount: 0, xml: validXml };
  const { service, files } = makeService({ serialized, client });
  const ready = await service.finalize({
    project,
    form: { serialize: async () => serialized, getEntityEffects: async () => [] },
    version,
  });

  const failed = await service.send({ project, localInstanceId: ready.localInstanceId });
  assert.equal(failed.ok, false);
  assert.equal(failed.instance.state, 'ready');
  assert.match(failed.instance.sendError, /<redacted>/);
  assert.doesNotMatch(failed.instance.sendError, /app-user-secret|query-secret|bearer-secret/);
  assert.equal(files.content.get(ready.xmlFileKey), validXml, 'failed sends retain authoritative XML');

  const sent = await service.send({ project, localInstanceId: ready.localInstanceId });
  assert.equal(sent.ok, true);
  assert.equal(sent.instance.state, 'sent');
  assert.match(sent.instance.sendReceipt, /<redacted>/);
  assert.doesNotMatch(sent.instance.sendReceipt, /receipt-secret/);
  assert.equal(client.calls.length, 2, 'retry requires a second explicit send call');
  assert.deepEqual(
    client.calls,
    [validXml, validXml],
    'a retry sends exact persisted XML bytes rather than serializing a new instance'
  );
  assert.equal(acceptedXml, validXml, 'the simulated server accepted the first request before its response was lost');
});

test('image attachment copies bytes, keeps XML authoritative, restores metadata, and cleans discarded media', async () => {
  const sourceBytes = new Uint8Array([7, 6, 5, 4]);
  let attachedFilename = null;
  const serialized = () => ({
    status: 'success',
    violationCount: 0,
    xml: validXml.replace('</data>', `<flower_photo>${attachedFilename ?? ''}</flower_photo></data>`),
  });
  const { service, instances, files, calls } = makeService();
  const form = {
    async setValue(reference, value) {
      assert.equal(reference, '/data/flower_photo');
      attachedFilename = value;
    },
    serialize: async () => serialized(),
    getEntityEffects: async () => [],
  };

  const bound = await service.attachImageMedia({
    project,
    form,
    version,
    reference: '/data/flower_photo',
    sourceFile: { bytes: async () => sourceBytes },
    contentType: 'image/jpeg',
  });
  assert.equal(bound.instance.state, 'draft');
  assert.match(bound.media.filename, /^image-[a-z0-9]+\.jpg$/);
  assert.equal(attachedFilename, bound.media.filename, 'engine receives the exact stored filename');
  assert.deepEqual(files.content.get(bound.media.fileKey), sourceBytes);
  assert.equal(calls[0][0], 'writeBytes', 'copy bytes before persisting XML metadata');
  assert.match(files.content.get(bound.instance.xmlFileKey), new RegExp(`<flower_photo>${bound.media.filename}</flower_photo>`));

  const resumedForm = { calls: [], loadInstance: async (...args) => resumedForm.calls.push(args) };
  const resumed = await service.resume({
    project,
    localInstanceId: bound.instance.localInstanceId,
    form: resumedForm,
  });
  assert.deepEqual(resumed.media, [bound.media]);
  assert.equal(resumedForm.calls.length, 1, 'resume is still XML restore, not answer replay');

  await service.discard({ project, localInstanceId: bound.instance.localInstanceId });
  assert.equal(instances.rows.size, 0);
  assert.equal(instances.media.size, 0, 'draft removal clears metadata');
  assert.equal(files.content.has(bound.instance.xmlFileKey), false);
  assert.equal(files.content.has(bound.media.fileKey), false, 'discard removes copied media bytes');
});

test('foreground send passes the resolved native media file through the central-client contract', async () => {
  const sourceBytes = new Uint8Array([1, 2, 3]);
  let attachedFilename = null;
  let submitInput = null;
  const serialized = () => ({
    status: 'success',
    violationCount: 0,
    xml: validXml.replace('</data>', `<flower_photo>${attachedFilename ?? ''}</flower_photo></data>`),
  });
  const client = {
    async submit(input) {
      submitInput = input;
      return { status: 201, message: 'accepted' };
    },
  };
  const { service, files } = makeService({ client });
  const form = {
    setValue: async (_reference, value) => {
      attachedFilename = value;
    },
    serialize: async () => serialized(),
    getEntityEffects: async () => [],
  };
  const bound = await service.attachImageMedia({
    project,
    form,
    version,
    reference: '/data/flower_photo',
    sourceFile: { bytes: async () => sourceBytes },
    contentType: 'image/png',
  });
  const ready = await service.finalize({
    project,
    localInstanceId: bound.instance.localInstanceId,
    form,
    version,
  });
  const sent = await service.send({ project, localInstanceId: ready.localInstanceId });

  assert.equal(sent.ok, true);
  assert.match(submitInput.xml, new RegExp(`<flower_photo>${bound.media.filename}</flower_photo>`));
  assert.deepEqual(submitInput.attachments, [
    {
      name: bound.media.filename,
      contentType: 'image/png',
      data: files.fileForKey(bound.media.fileKey),
    },
  ]);
  assert.equal(submitInput.attachments[0].data.expoFile, true);
});

test('image attachment rejects non-image file types', async () => {
  const { service } = makeService();
  await assert.rejects(
    service.attachImageMedia({
      project,
      form: { setValue: async () => {}, serialize: async () => ({ xml: validXml }) },
      version,
      reference: '/data/flower_photo',
      sourceFile: { bytes: async () => new Uint8Array([1]) },
      contentType: 'audio/mpeg',
    }),
    (error) => {
      assert.equal(error.code, 'GATHER_INSTANCE_MEDIA');
      return true;
    }
  );
});

test('submission sanitizer redacts common credential forms without erasing useful context', () => {
  const sanitized = sanitizeSubmissionText(
    'POST https://user:pass@example/key/secret-value?st=one&token=two Authorization: Bearer three password=four {"api_key":"five"}'
  );
  assert.match(sanitized, /POST/);
  assert.doesNotMatch(sanitized, /user:pass|secret-value|one|two|three|four|five/);
  assert.match(sanitized, /<redacted>/);
});
