import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProvisioningError,
  createProvisioningService,
  normalizeManualProvisioning,
} from '../../src/provisioning/provisioningService.js';

const clone = (value) => (value == null ? null : { ...value });

const makeProjects = () => {
  const rows = new Map();
  let failUpsert = false;
  const repo = {
    async listProjects() {
      return [...rows.values()]
        .sort((a, b) => a.display_name.localeCompare(b.display_name))
        .map((row) => ({
          projectKey: row.project_key,
          displayName: row.display_name,
          baseUrl: row.base_url,
          centralProjectId: row.central_project_id,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
    },
    async getProject(projectKey) {
      const row = rows.get(projectKey);
      return row
        ? {
            projectKey: row.project_key,
            displayName: row.display_name,
            baseUrl: row.base_url,
            centralProjectId: row.central_project_id,
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }
        : null;
    },
    async getActiveProject() {
      return (await repo.listProjects()).find((project) => project.isActive) ?? null;
    },
    async countProjects() {
      return rows.size;
    },
    async upsertProject(project) {
      if (failUpsert) throw new Error('simulated SQLite failure');
      const old = rows.get(project.projectKey);
      rows.set(project.projectKey, {
        project_key: project.projectKey,
        display_name: project.displayName,
        base_url: project.baseUrl,
        central_project_id: project.centralProjectId,
        is_active: old?.is_active ?? false,
        created_at: old?.created_at ?? 'created',
        updated_at: 'updated',
      });
      return repo.getProject(project.projectKey);
    },
    async setActiveProject(projectKey) {
      if (!rows.has(projectKey)) throw new Error('missing project');
      for (const row of rows.values()) row.is_active = false;
      rows.get(projectKey).is_active = true;
      return repo.getProject(projectKey);
    },
    async clearActiveProject() {
      for (const row of rows.values()) row.is_active = false;
    },
    async deleteProject(projectKey) {
      const project = await repo.getProject(projectKey);
      if (!project) throw new Error('missing project');
      rows.delete(projectKey);
      return project;
    },
    setFailUpsert(value) {
      failUpsert = value;
    },
  };
  return repo;
};

const makeDependencies = ({ failFileDelete = false, usage = { drafts: 0, ready: 0 } } = {}) => {
  const projects = makeProjects();
  const tokens = new Map();
  const directories = new Set();
  const verificationConfigs = [];
  const credentials = {
    async getProjectToken(projectKey) {
      return tokens.get(projectKey) ?? null;
    },
    async setProjectToken(projectKey, token) {
      tokens.set(projectKey, token);
    },
    async deleteProjectCredentials(projectKey) {
      tokens.delete(projectKey);
    },
  };
  const files = {
    async ensureProjectDirectories(projectKey) {
      directories.add(projectKey);
    },
    async deleteProjectDirectory(projectKey) {
      if (failFileDelete) throw new Error('simulated file cleanup failure');
      directories.delete(projectKey);
    },
  };
  return {
    projects,
    credentials,
    files,
    tokens,
    directories,
    verificationConfigs,
    createClient(config) {
      verificationConfigs.push(clone(config));
      return { listForms: async () => [] };
    },
    getProjectUsage: async () => usage,
  };
};

const validManualConfig = (overrides = {}) => ({
  baseUrl: 'https://central.example.org/',
  projectId: '12',
  token: 'secret-app-user-token',
  displayName: 'Kernza',
  ...overrides,
});

test('manual provisioning validates HTTPS URL, numeric project ID, token, and display name', () => {
  assert.deepEqual(normalizeManualProvisioning(validManualConfig()), {
    baseUrl: 'https://central.example.org',
    projectId: 12,
    token: 'secret-app-user-token',
    displayName: 'Kernza',
  });
  for (const overrides of [
    { baseUrl: 'http://central.example.org' },
    { projectId: '12.5' },
    { projectId: '0' },
    { token: ' token ' },
    { displayName: '   ' },
  ]) {
    assert.throws(
      () => normalizeManualProvisioning(validManualConfig(overrides)),
      ProvisioningError
    );
  }
});

test('verifies App User credentials through the Central client before storing project data', async () => {
  const deps = makeDependencies();
  deps.createClient = () => ({
    async listForms() {
      throw new Error('401 should be hidden from UI');
    },
  });
  const service = createProvisioningService(deps);

  await assert.rejects(() => service.provisionManual(validManualConfig()), (error) => {
    assert.equal(error.code, 'GATHER_PROVISIONING_VERIFY_FAILED');
    assert.equal(error.details.stage, 'verification');
    return true;
  });
  assert.equal(await deps.projects.countProjects(), 0);
  assert.equal(deps.tokens.size, 0);
  assert.equal(deps.directories.size, 0);
});

test('provisions metadata/files/credential only after verification and returns no token', async () => {
  const deps = makeDependencies();
  const service = createProvisioningService(deps);
  const result = await service.provisionManual(validManualConfig());

  assert.equal(deps.verificationConfigs.length, 1);
  assert.deepEqual(
    {
      baseUrl: deps.verificationConfigs[0].baseUrl,
      projectId: deps.verificationConfigs[0].projectId,
    },
    { baseUrl: 'https://central.example.org', projectId: 12 }
  );
  assert.equal(result.created, true);
  assert.equal(result.project.displayName, 'Kernza');
  assert.equal(result.project.isActive, true);
  assert.equal(deps.tokens.get(result.project.projectKey), 'secret-app-user-token');
  assert.ok(deps.directories.has(result.project.projectKey));
  assert.doesNotMatch(JSON.stringify(result), /secret-app-user-token/);
  assert.equal('token' in result.project, false);
});

test('does not report success when a new-project persistence step fails and cleans up', async () => {
  const deps = makeDependencies();
  deps.projects.setFailUpsert(true);
  const service = createProvisioningService(deps);

  await assert.rejects(() => service.provisionManual(validManualConfig()), (error) => {
    assert.equal(error.code, 'GATHER_PROVISIONING_PERSIST_FAILED');
    assert.equal(error.details.stage, 'persistence');
    assert.equal(error.details.recovery.credentialsRemoved, true);
    assert.equal(error.details.recovery.directoryRemoved, true);
    return true;
  });
  assert.equal(await deps.projects.countProjects(), 0);
  assert.equal(deps.tokens.size, 0);
  assert.equal(deps.directories.size, 0);
});

test('switches among multiple projects and requires a removal confirmation with draft/ready warning', async () => {
  const deps = makeDependencies({ usage: { drafts: 2, ready: 1 } });
  const service = createProvisioningService(deps);
  const first = await service.provisionManual(validManualConfig());
  const second = await service.provisionManual(
    validManualConfig({
      baseUrl: 'https://second.example.org',
      projectId: '3',
      token: 'second-secret',
      displayName: 'Second',
    })
  );

  const switched = await service.switchProject(first.project.projectKey);
  assert.equal(switched.projectKey, first.project.projectKey);
  assert.equal((await deps.projects.getActiveProject()).projectKey, first.project.projectKey);

  const preview = await service.getRemovalPreview(first.project.projectKey);
  assert.deepEqual(preview.usage, { drafts: 2, ready: 1 });
  assert.match(preview.warning, /2 drafts and 1 ready submission/);
  assert.equal(preview.requiresConfirmation, true);

  const unconfirmed = await service.removeProject(first.project.projectKey);
  assert.equal(unconfirmed.requiresConfirmation, true);
  assert.ok(await deps.projects.getProject(first.project.projectKey));

  const removed = await service.removeProject(first.project.projectKey, { confirmed: true });
  assert.equal(removed.removed, true);
  assert.equal(await deps.projects.getProject(first.project.projectKey), null);
  assert.equal(deps.tokens.has(first.project.projectKey), false);
  assert.equal(deps.directories.has(first.project.projectKey), false);
  assert.equal(removed.activeProject.projectKey, second.project.projectKey);
  assert.doesNotMatch(JSON.stringify(removed), /secret-app-user-token|second-secret/);
});

test('failed cleanup never reports removal success and restores the credential when possible', async () => {
  const deps = makeDependencies({ failFileDelete: true });
  const service = createProvisioningService(deps);
  const provisioned = await service.provisionManual(validManualConfig());

  await assert.rejects(
    () => service.removeProject(provisioned.project.projectKey, { confirmed: true }),
    (error) => {
      assert.equal(error.code, 'GATHER_PROJECT_REMOVE_FAILED');
      assert.equal(error.details.stage, 'removal');
      assert.equal(error.details.recovery.credentialsRestored, true);
      assert.doesNotMatch(JSON.stringify(error), /secret-app-user-token/);
      return true;
    }
  );
  assert.ok(await deps.projects.getProject(provisioned.project.projectKey));
  assert.equal(deps.tokens.get(provisioned.project.projectKey), 'secret-app-user-token');
  assert.ok(deps.directories.has(provisioned.project.projectKey));
});
