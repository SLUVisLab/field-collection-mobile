import assert from 'node:assert/strict';
import test from 'node:test';

import { createProvisioningService } from '../../src/provisioning/provisioningService.js';

const { ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_APP_USER_TOKEN } = process.env;
const LIVE = Boolean(ODK_CENTRAL_URL && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_APP_USER_TOKEN);
const skip = LIVE ? false : 'live env not configured (set ODK_CENTRAL_* to run)';

const makeMemoryDependencies = () => {
  const projects = new Map();
  const tokens = new Map();
  const directories = new Set();
  const toProject = (row) => (row ? { ...row } : null);

  return {
    projects: {
      async listProjects() {
        return [...projects.values()].map(toProject);
      },
      async getProject(projectKey) {
        return toProject(projects.get(projectKey));
      },
      async getActiveProject() {
        return toProject([...projects.values()].find((project) => project.isActive));
      },
      async upsertProject(project) {
        projects.set(project.projectKey, { ...project, isActive: projects.get(project.projectKey)?.isActive ?? false });
        return toProject(projects.get(project.projectKey));
      },
      async setActiveProject(projectKey) {
        for (const project of projects.values()) project.isActive = false;
        const project = projects.get(projectKey);
        if (!project) throw new Error('project not found');
        project.isActive = true;
        return toProject(project);
      },
      async clearActiveProject() {
        for (const project of projects.values()) project.isActive = false;
      },
      async deleteProject(projectKey) {
        const project = projects.get(projectKey);
        if (!project) throw new Error('project not found');
        projects.delete(projectKey);
        return toProject(project);
      },
    },
    credentials: {
      async getProjectToken(projectKey) {
        return tokens.get(projectKey) ?? null;
      },
      async setProjectToken(projectKey, token) {
        tokens.set(projectKey, token);
      },
      async deleteProjectCredentials(projectKey) {
        tokens.delete(projectKey);
      },
    },
    files: {
      async ensureProjectDirectories(projectKey) {
        directories.add(projectKey);
      },
      async deleteProjectDirectory(projectKey) {
        directories.delete(projectKey);
      },
    },
  };
};

test('live: verifies an App User before locally provisioning Central metadata', { skip }, async () => {
  const dependencies = makeMemoryDependencies();
  const result = await createProvisioningService(dependencies).provisionManual({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    token: ODK_CENTRAL_APP_USER_TOKEN,
    displayName: 'Live Central verification',
  });

  assert.equal(result.project.baseUrl, ODK_CENTRAL_URL.replace(/\/+$/, ''));
  assert.equal(result.project.centralProjectId, Number(ODK_CENTRAL_PROJECT_ID));
  assert.equal(result.created, true);
  assert.equal('token' in result.project, false);
});
