/**
 * A library build beside the app build, for the packaging module the wrapper
 * imports. See src/packagingEntry.js for why this exists at all.
 *
 * `emptyOutDir: false` because it writes into `public/authoring/packaging/`,
 * which `scripts/generate-model-catalog.mjs` has already populated — wiping it
 * would delete the catalog projections the same directory carries.
 */
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // The output lands *inside* `public/`, which is also Vite's publicDir. Left
  // on, the build copies public/ into itself, forever. A library build has no
  // static assets of its own anyway.
  publicDir: false,
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/packagingEntry.js'),
      formats: ['es'],
      fileName: () => 'gatherPack.js',
    },
    outDir: resolve(import.meta.dirname, 'public/authoring/packaging'),
    emptyOutDir: false,
    // Readable on purpose: this is served as a Gather source artifact, and a
    // wrapper developer stepping into it should see Gather's own code.
    minify: false,
  },
});
