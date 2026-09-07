/**
 * Copies the vendored OpenCV build into `public/`, where the preview fetches it.
 *
 * ```text
 * vendor/opencv/{opencv.js,opencv_js.wasm}   committed, built by tools/opencv-build
 *          ↓ (this script, at build time)
 * public/opencv/…                            served, gitignored like the rest of public/
 * ```
 *
 * The hashes in `provenance.json` are checked on the way through. That file
 * records what produced these bytes — emsdk version, OpenCV version, module
 * list, build flags — and a copy step is the last moment where "the artifact in
 * the tree is the artifact the build produced" can still be cheaply true. The
 * alternative is discovering a truncated checkout as a measurement that fails
 * inside WASM.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = resolve(here, '../vendor/opencv');
const to = resolve(here, '../public/opencv');

const provenance = JSON.parse(readFileSync(resolve(from, 'provenance.json'), 'utf8'));

mkdirSync(to, { recursive: true });

for (const [name, expected] of Object.entries(provenance.artifacts)) {
  const bytes = readFileSync(resolve(from, name));
  const actual = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (actual !== expected) {
    throw new Error(
      `${name} does not match its provenance.\n  expected ${expected}\n  found    ${actual}\n` +
        'Rebuild it with tools/opencv-build/build.sh rather than editing it in place.'
    );
  }
  copyFileSync(resolve(from, name), resolve(to, name));
}

const megabytes = Object.keys(provenance.artifacts)
  .map((name) => readFileSync(resolve(from, name)).length)
  .reduce((total, size) => total + size, 0) / 1024 / 1024;

console.log(
  `opencv: ${Object.keys(provenance.artifacts).join(', ')} → public/opencv ` +
    `(${megabytes.toFixed(1)} MB, OpenCV ${provenance.opencvVersion} ${provenance.modules}, ` +
    `emsdk ${provenance.emsdkVersion})`
);
