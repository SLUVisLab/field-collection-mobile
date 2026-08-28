/**
 * `gather-storage` public entry — the native wiring layer.
 *
 * Establishes the minimal durable local-storage primitives shared by M5 and the
 * later offline runtime, over three technologies with strict roles:
 *   - SQLite      → structured, queryable metadata (real handle exposed).
 *   - FileSystem  → large/file-shaped artifacts (durable vs cache).
 *   - SecureStore → credentials ONLY.
 *
 * This module imports the native `expo-*` modules, so it must not be imported by
 * Node unit tests (which target the pure submodules directly).
 */

import * as SecureStore from 'expo-secure-store';

import { createCredentialStore } from './credentials.js';
import {
  GATHER_DATABASE_NAME,
  gatherSchemaVersion,
  migrateGatherDatabase,
  openGatherDatabase,
} from './database.js';
import { ensureGatherDirectories, gatherRoots } from './filesystem.js';

/** Production SecureStore adapter (the injected seam's real implementation). */
const nativeSecureStore = {
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
};

/** Ready-to-use credential store backed by the device Keychain/Keystore. */
export const CredentialStore = createCredentialStore(nativeSecureStore);

let cachedDb = null;

/**
 * Idempotent application entry point. Safe to call repeatedly. It:
 *   1. ensures the durable/cache Gather root directories exist;
 *   2. opens the canonical Gather SQLite database (once);
 *   3. configures SQLite (foreign keys, WAL — done in openGatherDatabase);
 *   4. runs any pending migrations;
 *   5. returns the handles the app needs.
 *
 * It never connects to Central, syncs, downloads resources, or touches XForms.
 */
export const initializeGatherStorage = async () => {
  ensureGatherDirectories();
  if (!cachedDb) {
    cachedDb = await openGatherDatabase();
  }
  const migration = await migrateGatherDatabase(cachedDb);
  return {
    database: cachedDb,
    schemaVersion: gatherSchemaVersion(),
    migration,
    roots: gatherRoots(),
    credentials: CredentialStore,
  };
};

/** Close the cached database connection (e.g. to prove persistence on re-open). */
export const closeGatherStorage = async () => {
  if (cachedDb) {
    await cachedDb.closeAsync();
    cachedDb = null;
  }
};

// Pure policy re-exports.
export {
  GatherPaths,
  GATHER_DIRNAME,
  PROJECT_SUBDIRECTORIES,
  CACHE_SUBDIRECTORIES,
} from './paths.js';
export { createCredentialStore, projectTokenKey } from './credentials.js';
export { sanitizeErrorText } from './sanitize.js';
export { CsvError, parseCsv, serializeCsv } from './csv.js';
export { MIGRATIONS } from './migrations/index.js';
export {
  createProjectsRepository,
  rowToProject,
  ProjectsRepositoryError,
} from './repositories/projects.js';
export {
  createFormsRepository,
  formKeyFor,
  formVersionKeyFor,
  manifestFingerprintFor,
  FormsRepositoryError,
} from './repositories/forms.js';
export {
  createInstancesRepository,
  assertLocalInstanceId,
  INSTANCE_STATES,
  InstancesRepositoryError,
  rowToMedia,
} from './repositories/instances.js';
export {
  createSyncRepository,
  assertSyncOperationId,
  rowToSyncOperation,
  SYNC_OPERATION_KINDS,
  SYNC_OPERATION_STATES,
  SyncRepositoryError,
} from './repositories/sync.js';
export {
  createEntitiesRepository,
  normalizeEntityEffect,
  EntitiesRepositoryError,
} from './repositories/entities.js';

// Native binding re-exports.
export {
  GATHER_DATABASE_NAME,
  gatherSchemaVersion,
  openGatherDatabase,
  migrateGatherDatabase,
} from './database.js';
export {
  ensureProjectDirectories,
  deleteProjectDirectory,
  gatherRoots,
  fileForKey,
  directoryForKey,
  cacheFileForKey,
  writeTextAtomic,
  writeBytesAtomic,
  readText,
  readBytes,
  fileExists,
  deleteFile,
} from './filesystem.js';
