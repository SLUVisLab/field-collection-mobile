/**
 * Copies the model bytes the browser preview can execute, content-addressed.
 *
 * ```text
 * bundledModels declaration + canonical .onnx
 *          ↓ (this script, at build time)
 * public/models/<revision>/model.onnx
 * ```
 *
 * The revision in the path is the **ModelRef revision** — the same identity the
 * Tool pins and the device installs under — so a provider looks bytes up by the
 * thing it already has, and no URL ever enters a ModelRef.
 *
 * Only profiles the browser backend actually supports are copied. Shipping
 * bytes the preview cannot run would inflate the image for nothing and imply a
 * capability that is not there.
 */
import { copyFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createModelRef } from 'gather-models';

import { BUNDLED_MODELS } from '../../../src/compute/models/bundledModels.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../public/models');

/** What the browser backend can execute today. */
const SUPPORTED_PROFILES = new Set(['segmentation.binary.v1']);

const artifactPathFor = (declared) => {
  // The declaration reaches its bytes through a React Native `require` handle,
  // which means nothing here — but the package records the path, and that does.
  const relative = declared.modelPackage?.artifact?.path;
  if (!relative) return null;
  return resolve(here, '../../../assets/models', relative.split('/').pop());
};

mkdirSync(out, { recursive: true });
const copied = [];

for (const declared of BUNDLED_MODELS) {
  const modelRef = createModelRef(declared.modelPackage);
  if (!SUPPORTED_PROFILES.has(modelRef.taskProfile)) continue;

  const source = artifactPathFor(declared);
  if (!source) {
    throw new Error(`${modelRef.id} declares no artifact path, so its bytes cannot be located.`);
  }

  const bytes = readFileSync(source);
  const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const expected = declared.modelPackage.artifact.sha256;
  if (expected && digest !== expected) {
    // The package's own digest is the contract. Serving bytes that disagree
    // would make every downstream identity a lie.
    throw new Error(
      `${modelRef.id} bytes digest ${digest} but its package declares ${expected}.`
    );
  }

  const directory = resolve(out, modelRef.revision.replace(':', '-'));
  mkdirSync(directory, { recursive: true });
  copyFileSync(source, resolve(directory, 'model.onnx'));
  // The ModelPackage travels with its bytes, laid out exactly as the device's
  // model store does — `models/<revision>/model.json` + `model.onnx`. The
  // package stays authoritative about tensors and transforms; models.json is
  // still only an authoring projection.
  writeFileSync(
    resolve(directory, 'model.json'),
    `${JSON.stringify(declared.modelPackage, null, 2)}\n`
  );
  copied.push({
    id: modelRef.id,
    revision: modelRef.revision,
    taskProfile: modelRef.taskProfile,
    bytes: statSync(source).size,
  });
}

writeFileSync(
  resolve(out, 'index.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), models: copied }, null, 2)}\n`
);

console.log(`models/            ${copied.length} executable in the browser`);
for (const model of copied) {
  console.log(`  ${model.id.padEnd(34)}${(model.bytes / 1024 / 1024).toFixed(1)} MB  ${model.revision.slice(0, 20)}…`);
}
