import test from 'node:test';
import assert from 'node:assert/strict';

import { bootstrapGather, BootstrapError } from '../../src/bootstrap.js';

/** A fake projects repo with a settable active project and count. */
const makeRepo = ({ active = null, count = 0 } = {}) => ({
  async getActiveProject() {
    return active;
  },
  async countProjects() {
    return count;
  },
});

test('bootstrapGather validates its dependencies', async () => {
  await assert.rejects(() => bootstrapGather({}), BootstrapError);
  await assert.rejects(
    () => bootstrapGather({ initializeStorage: () => {}, createProjectsRepo: 3 }),
    BootstrapError
  );
});

test('bootstrapGather initializes storage before building the repo', async () => {
  const order = [];
  const database = { id: 'db' };
  const result = await bootstrapGather({
    initializeStorage: async () => {
      order.push('init-storage');
      return { database, schemaVersion: 2 };
    },
    createProjectsRepo: (db) => {
      order.push('make-repo');
      assert.equal(db, database, 'repo built over the opened database');
      return makeRepo({ active: null, count: 0 });
    },
  });
  assert.deepEqual(order, ['init-storage', 'make-repo']);
  assert.equal(result.storage.database, database);
});

test('bootstrapGather selects the setup shell when no project is active', async () => {
  const result = await bootstrapGather({
    initializeStorage: async () => ({ database: {} }),
    createProjectsRepo: () => makeRepo({ active: null, count: 0 }),
  });
  assert.equal(result.shell, 'setup');
  assert.equal(result.initialEntry, '/setup');
  assert.equal(result.activeProject, null);
  assert.equal(result.projectCount, 0);
});

test('bootstrapGather selects the project shell when a project is active', async () => {
  const active = { projectKey: 'kernza', displayName: 'Kernza' };
  const result = await bootstrapGather({
    initializeStorage: async () => ({ database: {} }),
    createProjectsRepo: () => makeRepo({ active, count: 2 }),
  });
  assert.equal(result.shell, 'project');
  assert.equal(result.initialEntry, '/project');
  assert.equal(result.activeProject, active);
  assert.equal(result.projectCount, 2);
  assert.equal(typeof result.repositories.projects.getActiveProject, 'function');
});

test('bootstrapGather wraps a storage failure with a coded BootstrapError', async () => {
  await assert.rejects(
    () =>
      bootstrapGather({
        initializeStorage: async () => {
          throw new Error('sqlite open failed');
        },
        createProjectsRepo: () => makeRepo(),
      }),
    (err) => {
      assert.equal(err.code, 'GATHER_BOOTSTRAP_STORAGE_FAILED');
      assert.match(err.cause.message, /sqlite open failed/);
      return true;
    }
  );
});

test('bootstrapGather rejects when storage returns no database handle', async () => {
  await assert.rejects(
    () =>
      bootstrapGather({
        initializeStorage: async () => ({ database: null }),
        createProjectsRepo: () => makeRepo(),
      }),
    (err) => {
      assert.equal(err.code, 'GATHER_BOOTSTRAP_NO_DATABASE');
      return true;
    }
  );
});

test('bootstrapGather wraps a project-registry read failure', async () => {
  await assert.rejects(
    () =>
      bootstrapGather({
        initializeStorage: async () => ({ database: {} }),
        createProjectsRepo: () => ({
          async getActiveProject() {
            throw new Error('no such table: projects');
          },
          async countProjects() {
            return 0;
          },
        }),
      }),
    (err) => {
      assert.equal(err.code, 'GATHER_BOOTSTRAP_PROJECTS_FAILED');
      return true;
    }
  );
});
