import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFormsRepository,
  formKeyFor,
  formVersionKeyFor,
  manifestFingerprintFor,
} from '../src/repositories/forms.js';

const makeFakeDb = () => {
  const forms = new Map();
  const versions = new Map();
  const resources = new Map();
  const drafts = new Set();
  const joinedVersion = (id) => {
    const version = versions.get(id);
    if (!version) return null;
    const form = forms.get(version.form_key);
    return form ? { ...version, ...form } : null;
  };

  return {
    calls: [],
    drafts,
    async getFirstAsync(sql, params = []) {
      this.calls.push(['getFirst', sql, params]);
      if (sql.includes('current_version_id')) {
        const form = forms.get(params[0]);
        return form ? { current_version_id: form.current_version_id } : null;
      }
      if (sql.includes('FROM drafts')) return drafts.has(params[0]) ? { referenced: 1 } : null;
      return joinedVersion(params[0]);
    },
    async getAllAsync(sql, params = []) {
      this.calls.push(['getAll', sql, params]);
      if (sql.includes('FROM form_resources')) return (resources.get(params[0]) ?? []).map((row) => ({ ...row }));
      const projectKey = params[0];
      return [...forms.values()]
        .filter((row) => row.project_key === projectKey)
        .sort((a, b) => a.display_name.localeCompare(b.display_name))
        .map((form) => {
          const version = versions.get(form.current_version_id);
          return {
            ...form,
            cached_at: version?.cached_at ?? null,
            resource_count: (resources.get(form.current_version_id) ?? []).length,
          };
        });
    },
    async runAsync(sql, params = []) {
      this.calls.push(['run', sql, params]);
      if (sql.includes('INSERT INTO forms')) {
        const [formKey, projectKey, formId, displayName, remoteVersion, remoteHash] = params;
        const existing = forms.get(formKey);
        forms.set(formKey, {
          form_key: formKey,
          project_key: projectKey,
          form_id: formId,
          display_name: displayName,
          remote_version: remoteVersion,
          remote_hash: remoteHash,
          current_version_id: existing?.current_version_id ?? null,
          refreshed_at: 'now',
        });
        return { changes: 1 };
      }
      if (sql.includes('INSERT OR IGNORE INTO form_versions')) {
        const [id, formKey, sourceVersion, sourceHash, fingerprint, xmlFileKey, manifestFileKey] = params;
        if (!versions.has(id)) {
          versions.set(id, {
            form_version_id: id,
            form_key: formKey,
            source_version: sourceVersion,
            source_hash: sourceHash,
            manifest_fingerprint: fingerprint,
            xml_file_key: xmlFileKey,
            manifest_file_key: manifestFileKey,
            cached_at: 'now',
          });
        }
        return { changes: 1 };
      }
      if (sql.includes('INSERT OR IGNORE INTO form_resources')) {
        const [versionId, filename, hash, type, isEntityList, contentType, fileKey] = params;
        const existing = resources.get(versionId) ?? [];
        if (!existing.some((row) => row.filename === filename)) {
          resources.set(versionId, [
            ...existing,
            {
              form_version_id: versionId,
              filename,
              resource_hash: hash,
              resource_type: type,
              is_entity_list: isEntityList,
              content_type: contentType,
              file_key: fileKey,
            },
          ]);
        }
        return { changes: 1 };
      }
      if (sql.includes('SET current_version_id')) {
        const [versionId, formKey] = params;
        forms.get(formKey).current_version_id = versionId;
        return { changes: 1 };
      }
      if (sql.includes('SET display_name')) {
        const [displayName, remoteVersion, remoteHash, versionId, formKey] = params;
        Object.assign(forms.get(formKey), {
          display_name: displayName,
          remote_version: remoteVersion,
          remote_hash: remoteHash,
          current_version_id: versionId,
        });
        return { changes: 1 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    async withTransactionAsync(fn) {
      await fn();
    },
  };
};

const cacheInput = {
  projectKey: 'project-1',
  formId: 'silphium entities',
  displayName: 'Silphium',
  sourceVersion: '20260828',
  sourceHash: 'md5:form',
  manifestFingerprint: 'manifest-v1',
  xmlFileKey: 'projects/project-1/forms/form-a/revision-a/form.xml',
  manifestFileKey: 'projects/project-1/forms/form-a/revision-a/manifest.json',
  resources: [
    {
      filename: 'plants.csv',
      hash: 'dataset-v1',
      type: 'entityList',
      isEntityList: true,
      contentType: 'text/csv',
      fileKey: 'projects/project-1/resources/form-a/revision-a/resource-a/payload',
    },
  ],
};

test('form cache identifiers preserve exact source identity', () => {
  const formKey = formKeyFor({ projectKey: 'p', formId: 'a/b' });
  const fingerprint = manifestFingerprintFor([
    { filename: 'b.csv', hash: '2', isEntityList: true },
    { filename: 'a.jpg', hash: '1', type: null, isEntityList: false },
  ]);
  const version = formVersionKeyFor({
    formKey,
    sourceVersion: '7',
    sourceHash: 'md5:x',
    manifestFingerprint: fingerprint,
  });
  assert.equal(formKey, '["p","a/b"]');
  assert.match(fingerprint, /a\.jpg/);
  assert.match(version, /md5:x/);
});

test('form repository records immutable versions and never rewrites a draft reference', async () => {
  const db = makeFakeDb();
  const repo = createFormsRepository(db);
  const first = await repo.recordCachedVersion(cacheInput);
  assert.equal(first.xmlFileKey, cacheInput.xmlFileKey);
  assert.equal(first.resources[0].fileKey, cacheInput.resources[0].fileKey);

  db.drafts.add(first.formVersionId);
  assert.equal(await repo.versionHasDrafts(first.formVersionId), true);

  await repo.recordCachedVersion({
    ...cacheInput,
    xmlFileKey: 'projects/project-1/forms/evil.xml',
    resources: [{ ...cacheInput.resources[0], fileKey: 'projects/project-1/resources/evil.csv' }],
  });
  const restored = await repo.getVersion(first.formVersionId);
  assert.equal(restored.xmlFileKey, cacheInput.xmlFileKey, 'version XML remains insert-only');
  assert.equal(restored.resources[0].fileKey, cacheInput.resources[0].fileKey, 'resource remains insert-only');
  assert.equal(
    db.calls.some(([kind, sql]) => kind === 'run' && /UPDATE form_versions|UPDATE form_resources/.test(sql)),
    false,
    'repository never issues updates against immutable rows'
  );
});

test('current catalog rows point at the selected immutable version', async () => {
  const db = makeFakeDb();
  const repo = createFormsRepository(db);
  const stored = await repo.recordCachedVersion(cacheInput);
  const current = await repo.getCurrentVersion(cacheInput.projectKey, cacheInput.formId);
  assert.equal(current.formVersionId, stored.formVersionId);
  const catalog = await repo.listForms(cacheInput.projectKey);
  assert.deepEqual(catalog.map((form) => form.formId), [cacheInput.formId]);
  assert.equal(catalog[0].resourceCount, 1);
});
