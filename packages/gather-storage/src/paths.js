/**
 * Gather storage path & key policy — PURE (no `expo-*` imports).
 *
 * This module owns Gather's storage topology: the deterministic, project-scoped
 * layout and the rules that keep it safe. It deliberately deals only in
 * **Gather-relative keys** (e.g. `projects/abc/forms/silphium/form.xml`) rather
 * than absolute device URIs, because those relative keys are what belong in
 * SQLite metadata; the native binding (`filesystem.js`) resolves them against the
 * current Expo FileSystem location at runtime.
 *
 * Keeping this pure is intentional: it is fully unit-testable in Node, and no
 * native module can be imported there (see the package README).
 */

export const GATHER_DIRNAME = 'gather';

/** Standard per-project subdirectories under `projects/<projectKey>/`. */
export const PROJECT_SUBDIRECTORIES = Object.freeze([
  'forms',
  'resources',
  'instances',
  'media',
  'instruments',
  'models',
]);

/** Standard cache subdirectories under the Gather cache root. */
export const CACHE_SUBDIRECTORIES = Object.freeze(['temp', 'thumbnails']);

export class GatherPathError extends Error {
  constructor(message, { code = 'GATHER_PATH_INVALID', details = null } = {}) {
    super(message);
    this.name = 'GatherPathError';
    this.code = code;
    this.details = details;
  }
}

const pathError = (message, details) => new GatherPathError(message, { details });

/**
 * Project keys are stable local identifiers used both as filesystem path
 * segments and (namespaced) as SecureStore keys, so they are restricted to the
 * SecureStore-safe charset `[A-Za-z0-9._-]` and may not begin with a dot (which
 * would also make traversal tokens like `.`/`..` representable).
 */
const PROJECT_KEY_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

export const assertProjectKey = (projectKey) => {
  if (typeof projectKey !== 'string' || projectKey.length === 0) {
    throw pathError('projectKey must be a non-empty string', { projectKey });
  }
  if (projectKey === '.' || projectKey === '..') {
    throw pathError('projectKey must not be a path traversal token', { projectKey });
  }
  if (!PROJECT_KEY_RE.test(projectKey)) {
    throw pathError(
      'projectKey may only contain letters, digits, ".", "-", "_" and must not start with "."',
      { projectKey }
    );
  }
  return projectKey;
};

/** Validate a single path segment (a folder or file name). */
const assertSegment = (segment) => {
  if (typeof segment !== 'string' || segment.length === 0) {
    throw pathError('path segment must be a non-empty string', { segment });
  }
  if (segment === '.' || segment === '..') {
    throw pathError('path segment must not be "." or ".."', { segment });
  }
  if (/[\\/]/.test(segment)) {
    throw pathError('path segment must not contain a path separator', { segment });
  }
  if (segment.includes('\u0000')) {
    throw pathError('path segment must not contain a null byte', { segment });
  }
  if (segment.trim().length === 0) {
    throw pathError('path segment must not be whitespace only', { segment });
  }
  return segment;
};

/** Build a validated Gather-relative key from segments (arrays are flattened). */
export const joinKey = (...segments) => {
  const flat = segments.flat().filter((s) => s !== undefined && s !== null);
  if (flat.length === 0) {
    throw pathError('a key requires at least one segment');
  }
  return flat.map(assertSegment).join('/');
};

/**
 * Validate & normalize an existing relative key string (e.g. one read back from
 * SQLite metadata). Rejects absolute paths, URI schemes and traversal.
 */
export const assertRelativeKey = (key) => {
  if (typeof key !== 'string' || key.length === 0) {
    throw pathError('relative key must be a non-empty string', { key });
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(key)) {
    throw pathError('relative key must not be an absolute URI', { key });
  }
  if (key.startsWith('/')) {
    throw pathError('relative key must not be absolute', { key });
  }
  const segments = key.split('/');
  segments.forEach(assertSegment);
  return segments.join('/');
};

/** Split a validated relative key into path segments for File/Directory construction. */
export const keyToSegments = (key) => assertRelativeKey(key).split('/');

/**
 * Project-scoped relative-key builders. Each returns a Gather-relative key
 * string (never an absolute device path). Persist these in metadata and resolve
 * them later via the native binding.
 */
export const GatherPaths = Object.freeze({
  project: (projectKey) => joinKey('projects', assertProjectKey(projectKey)),
  forms: (projectKey, ...rest) => joinKey('projects', assertProjectKey(projectKey), 'forms', ...rest),
  resources: (projectKey, ...rest) =>
    joinKey('projects', assertProjectKey(projectKey), 'resources', ...rest),
  instances: (projectKey, ...rest) =>
    joinKey('projects', assertProjectKey(projectKey), 'instances', ...rest),
  media: (projectKey, ...rest) => joinKey('projects', assertProjectKey(projectKey), 'media', ...rest),
  instruments: (projectKey, ...rest) =>
    joinKey('projects', assertProjectKey(projectKey), 'instruments', ...rest),
  models: (projectKey, ...rest) => joinKey('projects', assertProjectKey(projectKey), 'models', ...rest),
  /** The standard directory keys created for a project. */
  projectDirectories: (projectKey) => {
    const pk = assertProjectKey(projectKey);
    return PROJECT_SUBDIRECTORIES.map((sub) => joinKey('projects', pk, sub));
  },
});
