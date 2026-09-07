/**
 * Gather's packaging, as one ES module the wrapper can import.
 *
 * `packTool` reaches `gather-hashing`, which reaches `js-sha256` — a CommonJS
 * package with no ESM build. The wrapper has no bundler and should not grow one
 * to gain a sha256, so the renderer (which already bundles all of this for the
 * preview) emits a self-contained library build instead.
 *
 * This is not a second implementation. It is the same `packTool` the device
 * install path and the `.gather` gate use, compiled once and served. A wrapper
 * that reimplemented packing would be a second answer to "what is in this
 * package", and the first time the two disagreed the artifact would be the one
 * nobody tested.
 *
 * Built by vite.pack.config.js into public/authoring/packaging/gatherPack.js.
 */
export { PublicationError, planPublication } from '../../../src/packaging/publicationPlan.js';
export { GATHER_PACKAGE_VERSION, PackageError, packTool } from '../../../src/packaging/gatherPackage.js';
export { createModelRef, modelRevisionFor } from 'gather-models';
