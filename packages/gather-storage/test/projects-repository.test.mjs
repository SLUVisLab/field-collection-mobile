import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ProjectsRepositoryError,
  createProjectsRepository,
  rowToProject,
} from '../src/repositories/projects.js';

/**
 * A purpose-built in-memory fake of the `expo-sqlite` async surface the projects
 * repository uses. It models just enough of a `projects` table (a Map keyed by
 * project_key plus the single-active invariant) to exercise the repository's
 * orchestration without a real SQLite engine — the same fake-db approach the
 * migration runner tests use.
 */
const makeFakeDb = () => {
  const rows = new Map();
  const now = () => '2026-01-01T00:00:00.000Z';

  const insertOrUpdate = (params) => {
    const [key, displayName, baseUrl, centralProjectId] = params;
    const existing = rows.get(key);
    rows.set(key, {
      project_key: key,
      display_name: displayName,
      base_url: baseUrl,
      central_project_id: centralProjectId ?? null,
      is_active: existing ? existing.is_active : 0,
      created_at: existing ? existing.created_at : now(),
      updated_at: now(),
    });
  };

  const clearActive = () => {
    for (const row of rows.values()) {
      if (row.is_active === 1) {
        row.is_active = 0;
        row.updated_at = now();
      }
    }
  };

  const setActive = (key) => {
    const row = rows.get(key);
    if (row) {
      row.is_active = 1;
      row.updated_at = now();
    }
  };

  const db = {
    calls: [],
    async getAllAsync(sql) {
      this.calls.push(['getAll', sql]);
      const all = [...rows.values()];
      all.sort((a, b) =>
        a.display_name.toLowerCase() < b.display_name.toLowerCase() ? -1 : 1
      );
      return all.map((r) => ({ ...r }));
    },
    async getFirstAsync(sql, params = []) {
      this.calls.push(['getFirst', sql, params]);
      if (sql.includes('COUNT(*)')) {
        return { n: rows.size };
      }
      if (sql.includes('is_active = 1')) {
        const active = [...rows.values()].find((r) => r.is_active === 1);
        return active ? { ...active } : null;
      }
      // by project_key
      const row = rows.get(params[0]);
      return row ? { ...row } : null;
    },
    async runAsync(sql, params = []) {
      this.calls.push(['run', sql, params]);
      if (sql.includes('INSERT INTO projects')) {
        insertOrUpdate(params);
        return { changes: 1 };
      }
      if (sql.includes('SET is_active = 0')) {
        clearActive();
        return { changes: 1 };
      }
      if (sql.includes('SET is_active = 1')) {
        setActive(params[0]);
        return { changes: 1 };
      }
      if (sql.includes('DELETE FROM projects')) {
        const existed = rows.delete(params[0]);
        return { changes: existed ? 1 : 0 };
      }
      throw new Error(`unexpected runAsync: ${sql}`);
    },
    async withTransactionAsync(fn) {
      this.calls.push(['txn:begin']);
      await fn();
      this.calls.push(['txn:commit']);
    },
  };
  return db;
};

test('createProjectsRepository rejects a non-conforming db adapter', () => {
  assert.throws(() => createProjectsRepository({}), ProjectsRepositoryError);
  assert.throws(() => createProjectsRepository(null), ProjectsRepositoryError);
});

test('rowToProject maps and types SQLite rows', () => {
  assert.equal(rowToProject(null), null);
  assert.deepEqual(
    rowToProject({
      project_key: 'p1',
      display_name: 'Kernza',
      base_url: 'https://central.example',
      central_project_id: 7,
      is_active: 1,
      created_at: 'c',
      updated_at: 'u',
    }),
    {
      projectKey: 'p1',
      displayName: 'Kernza',
      baseUrl: 'https://central.example',
      centralProjectId: 7,
      isActive: true,
      createdAt: 'c',
      updatedAt: 'u',
    }
  );
});

test('a fresh registry reports no projects and no active project', async () => {
  const repo = createProjectsRepository(makeFakeDb());
  assert.equal(await repo.countProjects(), 0);
  assert.equal(await repo.getActiveProject(), null);
  assert.deepEqual(await repo.listProjects(), []);
});

test('upsertProject inserts then updates by key without activating', async () => {
  const repo = createProjectsRepository(makeFakeDb());
  const created = await repo.upsertProject({
    projectKey: 'kernza',
    displayName: 'Kernza Trial',
    baseUrl: 'https://central.example',
    centralProjectId: 3,
  });
  assert.equal(created.projectKey, 'kernza');
  assert.equal(created.isActive, false);
  assert.equal(await repo.countProjects(), 1);

  const updated = await repo.upsertProject({
    projectKey: 'kernza',
    displayName: 'Kernza Trial 2026',
    baseUrl: 'https://central2.example',
  });
  assert.equal(updated.displayName, 'Kernza Trial 2026');
  assert.equal(updated.baseUrl, 'https://central2.example');
  assert.equal(updated.centralProjectId, null);
  assert.equal(await repo.countProjects(), 1, 'upsert did not duplicate the row');
});

test('upsertProject validates its inputs', async () => {
  const repo = createProjectsRepository(makeFakeDb());
  await assert.rejects(
    () => repo.upsertProject({ projectKey: '../evil', displayName: 'x', baseUrl: 'y' }),
    /projectKey/
  );
  await assert.rejects(
    () => repo.upsertProject({ projectKey: 'ok', displayName: '', baseUrl: 'y' }),
    ProjectsRepositoryError
  );
  await assert.rejects(
    () => repo.upsertProject({ projectKey: 'ok', displayName: 'x', baseUrl: '   ' }),
    ProjectsRepositoryError
  );
});

test('listProjects returns projects ordered by display name', async () => {
  const repo = createProjectsRepository(makeFakeDb());
  await repo.upsertProject({ projectKey: 'b', displayName: 'Zoysia', baseUrl: 'u' });
  await repo.upsertProject({ projectKey: 'a', displayName: 'alfalfa', baseUrl: 'u' });
  await repo.upsertProject({ projectKey: 'c', displayName: 'Millet', baseUrl: 'u' });
  const names = (await repo.listProjects()).map((p) => p.displayName);
  assert.deepEqual(names, ['alfalfa', 'Millet', 'Zoysia']);
});

test('setActiveProject enforces a single active project transactionally', async () => {
  const db = makeFakeDb();
  const repo = createProjectsRepository(db);
  await repo.upsertProject({ projectKey: 'one', displayName: 'One', baseUrl: 'u' });
  await repo.upsertProject({ projectKey: 'two', displayName: 'Two', baseUrl: 'u' });

  const active1 = await repo.setActiveProject('one');
  assert.equal(active1.projectKey, 'one');
  assert.equal(active1.isActive, true);
  assert.equal((await repo.getActiveProject()).projectKey, 'one');

  // Switching activates the new one and deactivates the old one.
  await repo.setActiveProject('two');
  const activeNow = await repo.getActiveProject();
  assert.equal(activeNow.projectKey, 'two');
  const activeCount = (await repo.listProjects()).filter((p) => p.isActive).length;
  assert.equal(activeCount, 1, 'exactly one project stays active');

  // The switch clears the old active row before setting the new one, inside a txn.
  const txnRuns = db.calls.filter((c) => c[0] === 'run' && /is_active = 0/.test(c[1]));
  assert.ok(txnRuns.length >= 1, 'clears the previous active row');
  assert.ok(db.calls.some((c) => c[0] === 'txn:begin'));
  assert.ok(db.calls.some((c) => c[0] === 'txn:commit'));
});

test('setActiveProject throws for an unknown project and stays consistent', async () => {
  const repo = createProjectsRepository(makeFakeDb());
  await repo.upsertProject({ projectKey: 'known', displayName: 'Known', baseUrl: 'u' });
  await repo.setActiveProject('known');
  await assert.rejects(() => repo.setActiveProject('ghost'), (err) => {
    assert.equal(err.code, 'GATHER_PROJECTS_NOT_FOUND');
    return true;
  });
  assert.equal((await repo.getActiveProject()).projectKey, 'known');
});

test('clearActiveProject returns the shell to setup without deleting projects', async () => {
  const repo = createProjectsRepository(makeFakeDb());
  await repo.upsertProject({ projectKey: 'p', displayName: 'P', baseUrl: 'u' });
  await repo.setActiveProject('p');
  assert.ok(await repo.getActiveProject());
  await repo.clearActiveProject();
  assert.equal(await repo.getActiveProject(), null);
  assert.equal(await repo.countProjects(), 1);
});

test('deleteProject removes only the requested metadata row transactionally', async () => {
  const db = makeFakeDb();
  const repo = createProjectsRepository(db);
  await repo.upsertProject({ projectKey: 'keep', displayName: 'Keep', baseUrl: 'u' });
  await repo.upsertProject({ projectKey: 'remove', displayName: 'Remove', baseUrl: 'u' });
  await repo.setActiveProject('remove');

  const removed = await repo.deleteProject('remove');
  assert.equal(removed.projectKey, 'remove');
  assert.equal(await repo.getProject('remove'), null);
  assert.equal((await repo.getProject('keep')).projectKey, 'keep');
  assert.equal(await repo.getActiveProject(), null);
  assert.ok(db.calls.some((call) => call[0] === 'txn:begin'));

  await assert.rejects(() => repo.deleteProject('missing'), (error) => {
    assert.equal(error.code, 'GATHER_PROJECTS_NOT_FOUND');
    return true;
  });
});
