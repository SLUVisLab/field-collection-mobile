/**
 * Application bootstrap orchestration — PURE (no React / React Native / expo imports).
 *
 * This is the business logic that decides how the app starts, kept OUT of the
 * route components per the M5.1 contract. It:
 *   1. initializes durable storage (gather-storage) exactly once, BEFORE any
 *      route that depends on it renders;
 *   2. builds the projects repository over the opened database;
 *   3. reads the active project to choose the setup-vs-project shell.
 *
 * All external effects are injected, so this is unit-testable in Node with fakes
 * and never imports a native module.
 */

import { shellForActiveProject, initialEntryForShell } from './navigation/routes.js';

export class BootstrapError extends Error {
  constructor(message, { code = 'GATHER_BOOTSTRAP_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'BootstrapError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * @param {{
 *   initializeStorage: () => Promise<{ database: object, schemaVersion: number,
 *     migration: object, roots: object, credentials: object }>,
 *   createProjectsRepo: (db: object) => object,
 * }} deps
 * @returns {Promise<{
 *   storage: object,
 *   repositories: { projects: object },
 *   activeProject: object | null,
 *   projectCount: number,
 *   shell: 'setup' | 'project',
 *   initialEntry: string,
 * }>}
 */
export const bootstrapGather = async ({ initializeStorage, createProjectsRepo }) => {
  if (typeof initializeStorage !== 'function' || typeof createProjectsRepo !== 'function') {
    throw new BootstrapError('bootstrapGather requires initializeStorage and createProjectsRepo', {
      code: 'GATHER_BOOTSTRAP_BAD_DEPS',
    });
  }

  let storage;
  try {
    // Storage MUST be ready before any dependent route renders.
    storage = await initializeStorage();
  } catch (cause) {
    throw new BootstrapError('failed to initialize durable storage', {
      code: 'GATHER_BOOTSTRAP_STORAGE_FAILED',
      cause,
    });
  }

  if (!storage || !storage.database) {
    throw new BootstrapError('storage initialization returned no database handle', {
      code: 'GATHER_BOOTSTRAP_NO_DATABASE',
    });
  }

  const projects = createProjectsRepo(storage.database);

  let activeProject = null;
  let projectCount = 0;
  try {
    activeProject = await projects.getActiveProject();
    projectCount = await projects.countProjects();
  } catch (cause) {
    throw new BootstrapError('failed to read the project registry', {
      code: 'GATHER_BOOTSTRAP_PROJECTS_FAILED',
      cause,
    });
  }

  const shell = shellForActiveProject(activeProject);

  return {
    storage,
    repositories: { projects },
    activeProject,
    projectCount,
    shell,
    initialEntry: initialEntryForShell(shell),
  };
};
