/**
 * Native FileSystem binding for Gather storage (imports `expo-file-system`).
 *
 * This is the ONLY place that touches the filesystem. It resolves the pure,
 * Gather-relative keys from `paths.js` into real Expo `File`/`Directory` objects
 * under a deterministic layout, and owns durable (atomic) writes.
 *
 * Not unit-tested in Node (native module); exercised by the device runtime gate.
 */

import { Directory, File, Paths } from 'expo-file-system';

import {
  CACHE_SUBDIRECTORIES,
  GATHER_DIRNAME,
  PROJECT_SUBDIRECTORIES,
  assertProjectKey,
  keyToSegments,
} from './paths.js';

/** Durable Gather root: `Documents/gather` (safe from system eviction). */
const persistentRoot = () => new Directory(Paths.document, GATHER_DIRNAME);
/** Disposable Gather root: `Cache/gather` (may be evicted by the OS). */
const cacheRoot = () => new Directory(Paths.cache, GATHER_DIRNAME);

export const gatherRoots = () => ({
  persistent: persistentRoot(),
  cache: cacheRoot(),
});

const ensureDir = (dir) => {
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
};

/** Idempotent creation of the top-level Gather directory tree. */
export const ensureGatherDirectories = () => {
  ensureDir(persistentRoot());
  const cache = ensureDir(cacheRoot());
  for (const sub of CACHE_SUBDIRECTORIES) {
    ensureDir(new Directory(cache, sub));
  }
};

/** Idempotent creation of a project's standard subdirectory tree. */
export const ensureProjectDirectories = (projectKey) => {
  const pk = assertProjectKey(projectKey);
  const projectDir = ensureDir(new Directory(persistentRoot(), 'projects', pk));
  for (const sub of PROJECT_SUBDIRECTORIES) {
    ensureDir(new Directory(projectDir, sub));
  }
  return projectDir;
};

/** Resolve a Gather-relative key to a durable `File`. */
export const fileForKey = (key) => new File(persistentRoot(), ...keyToSegments(key));
/** Resolve a Gather-relative key to a durable `Directory`. */
export const directoryForKey = (key) => new Directory(persistentRoot(), ...keyToSegments(key));
/** Resolve a Gather-relative key to a cache `File`. */
export const cacheFileForKey = (key) => new File(cacheRoot(), ...keyToSegments(key));

const randomSuffix = () =>
  `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

/**
 * Durable atomic write: write a temp sibling, then move it onto the canonical
 * path. An interrupted write therefore never leaves a corrupt canonical file.
 * Expo's `File.move` is used for the final swap (a rename on the same volume).
 */
const writeAtomic = async (target, content) => {
  ensureDir(target.parentDirectory);
  const tmp = new File(target.parentDirectory, `.${target.name}.tmp-${randomSuffix()}`);
  if (tmp.exists) {
    tmp.delete();
  }
  tmp.create({ intermediates: true, overwrite: true });
  tmp.write(content);
  try {
    if (target.exists) {
      target.delete();
    }
    await tmp.move(target);
  } catch (error) {
    if (tmp.exists) {
      tmp.delete();
    }
    throw error;
  }
  return target;
};

/** Atomically write UTF-8 text to a durable Gather-relative key. Returns the key. */
export const writeTextAtomic = async (key, text) => {
  await writeAtomic(fileForKey(key), text);
  return key;
};

/** Atomically write bytes to a durable Gather-relative key. Returns the key. */
export const writeBytesAtomic = async (key, bytes) => {
  await writeAtomic(fileForKey(key), bytes);
  return key;
};

export const readText = (key) => fileForKey(key).text();
export const readBytes = (key) => fileForKey(key).bytes();

/**
 * Reads a local file outside the Gather durable root before it is copied into
 * Gather-owned storage. This is intentionally limited to absolute local paths
 * and is used for camera-library temporary captures.
 */
export const readExternalBytes = (path) => {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new TypeError('External file path must be an absolute local path.');
  }
  return new File(`file://${path}`).bytes();
};

export const fileExists = (key) => fileForKey(key).exists;

export const deleteFile = (key) => {
  const file = fileForKey(key);
  if (file.exists) {
    file.delete();
  }
};

/**
 * The Gather-relative keys of the files directly inside a durable directory.
 *
 * Non-recursive and directory-skipping: asset cleanup enumerates one project's
 * media directory, and a missing directory is an empty listing rather than an
 * error, so a sweep can run on a project that has never stored anything.
 */
export const listDirectory = (key) => {
  const dir = directoryForKey(key);
  if (!dir.exists) return [];
  const prefix = keyToSegments(key).join('/');
  return dir
    .list()
    .filter((entry) => entry instanceof File)
    .map((entry) => `${prefix}/${entry.name}`);
};

/** Remove a project's entire durable tree (used when a project is deleted). */
export const deleteProjectDirectory = (projectKey) => {
  const pk = assertProjectKey(projectKey);
  const dir = new Directory(persistentRoot(), 'projects', pk);
  if (dir.exists) {
    dir.delete();
  }
};
