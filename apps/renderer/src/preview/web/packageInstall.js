/**
 * Installing a `.gather` package in the browser preview.
 *
 * The preview normally serves models this distribution ships, as static
 * content-addressed assets. A package brings its own bytes, and those bytes are
 * the point: a Tool that was frozen against a revision must run *that* revision
 * even on a host whose defaults have since moved.
 *
 * So installation here goes through exactly the same code the device uses —
 * `installTool` over `createModelStore` from `gather-models`. Only the file
 * backend differs, which is the seam the store was built with:
 *
 * ```text
 * device      expo-file-system      → app documents
 * preview     a Map for the session → discarded on reload
 * ```
 *
 * Nothing here knows how to *run* a composition. The package yields a
 * composition and some installed models; running it is the renderer's ordinary
 * preview path, unchanged. A second execution runtime that only packaged Tools
 * went through would be a second set of semantics for the same document.
 */
import { createModelStore } from 'gather-models';
import { modelRevisionFor } from 'gather-models';

import { installTool } from '../../../../../src/packaging/installTool.js';

const PROJECT_KEY = 'preview';

/** The session's device: a real model store over memory rather than disk. */
const createSessionStore = () => {
  const values = new Map();
  const store = createModelStore({
    readBytes: async (key) => values.get(key),
    readText: async (key) => values.get(key),
    writeBytesAtomic: async (key, value) => values.set(key, value),
    writeTextAtomic: async (key, value) => values.set(key, value),
    fileExists: async (key) => values.has(key),
    // The executor consumes bytes directly in the browser, so a key is all a
    // "path" needs to be here; `resolve` hands back `keys` to read them with.
    fileForKey: (key) => ({ uri: key }),
  });
  return { store, values };
};

const { store, values } = createSessionStore();
const installedRevisions = new Set();

/**
 * A model source over what this session has installed, falling through to the
 * distribution's static assets for everything else.
 *
 * Ordering matters and is the whole reason this wrapper exists: an installed
 * package answers first, so the gate can prove the executed bytes came from the
 * archive rather than from a static asset that happens to have the same digest.
 */
export const createInstalledFirstProvider = ({ fallback }) => ({
  async bytesFor(modelRef) {
    if (!installedRevisions.has(modelRef?.revision)) return fallback.bytesFor(modelRef);
    // `resolve` re-reads the lock and re-digests the artifact before answering,
    // so served bytes are verified against the revision every time.
    const resolved = await store.resolve({ projectKey: PROJECT_KEY, modelRef });
    return values.get(resolved.keys.artifact);
  },
  async packageFor(modelRef) {
    if (!installedRevisions.has(modelRef?.revision)) return fallback.packageFor(modelRef);
    const resolved = await store.resolve({ projectKey: PROJECT_KEY, modelRef });
    return resolved.model;
  },
  /** What this session installed — the gate's evidence, not a runtime input. */
  installed: () => [...installedRevisions],
});

/**
 * Opens, verifies and installs a package, and returns what it takes to run it.
 *
 * The composition comes back as it was read from the archive. Nobody merges it
 * with a draft or looks it up by id: the bytes that were packaged are the bytes
 * that render.
 */
export const installPackage = async (bytes) => {
  const result = await installTool({
    bytes,
    modelStore: store,
    projectKey: PROJECT_KEY,
    modelRevisionFor,
  });
  for (const model of result.models) installedRevisions.add(model.revision);
  return result;
};
