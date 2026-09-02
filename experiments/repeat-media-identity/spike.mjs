/**
 * Repeat media identity spike.
 *
 * Drives the real `@getodk/xforms-engine` headlessly to answer whether media
 * bound inside an XForms repeat has an identity that is both **unique** and
 * **stable under mutation**.
 *
 * It documents upstream engine behaviour: repeat references are positional and
 * reindex on deletion. Gather originally derived attachment filenames and
 * `instance_media` keys from those references, which made a survivor inherit a
 * deleted item's attachment. That is fixed (migration 10 +
 * `imageFilenameForCapture`); this spike keeps a local copy of the old
 * derivation to show why it could never work.
 *
 * See experiments/repeat-media-identity/README.md for how to run it, and
 * docs/repeat-media-identity-characterization.md for the findings.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.env.REPO;
if (!REPO) throw new Error('Set REPO to the repository root.');

// The engine expects a DOM; reuse the shim from the M2 slimdom experiment.
const require = createRequire(join(REPO, 'package.json'));
require(join(REPO, 'archive/experiments/m2-slimdom-xforms/installDomCompatibility.js'))
  .installSlimdomDomCompatibility({ force: true });

const engineDist = join(REPO, 'node_modules/@getodk/xforms-engine/dist');
globalThis.__dirname = engineDist;
globalThis.__filename = join(engineDist, 'index.js');
if (typeof globalThis.require !== 'function') globalThis.require = require;

const { loadForm } = await import(pathToFileURL(join(engineDist, 'index.js')).href);

const flatten = (node, out = []) => {
  out.push(node);
  for (const child of node.currentState?.children ?? []) flatten(child, out);
  return out;
};
const nodesNamed = (root, name) =>
  flatten(root).filter((n) => new RegExp(`/${name}(\\[\\d+\\])?$`).test(String(n.currentState?.reference ?? '')));
const photos = (root) => nodesNamed(root, 'photo');
// Upload nodes need a File-like value, so identity is marked on the sibling
// string node instead; the spike is about references, not bytes.
const captions = (root) => nodesNamed(root, 'caption');
// Reproduces the *original* defect: identity derived from the binding
// reference. Gather no longer does this — `imageFilenameForCapture` mints a
// filename once at capture — so this local copy exists only to show why.
const legacyNameFor = (reference) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < reference.length; index += 1) {
    hash = Math.imul(hash ^ reference.charCodeAt(index), 0x01000193);
  }
  return `image-${(hash >>> 0).toString(36)}.jpg`;
};

const report = (root, heading) => {
  console.log(`\n--- ${heading} ---`);
  const marks = captions(root);
  photos(root).forEach((node, index) => {
    const reference = node.currentState.reference;
    console.log(`  photo ref=${reference}`);
    console.log(`      marker=${JSON.stringify(marks[index]?.currentState?.value)}  legacy derived filename=${legacyNameFor(reference)}`);
  });
};

const loaded = await loadForm(readFileSync(process.env.FIXTURE, 'utf8'));
if (loaded.status === 'failure') throw new Error(String(loaded.error?.message ?? loaded.error));
const { root } = await loaded.createInstance();
const range = flatten(root).find((n) => String(n.nodeType).startsWith('repeat-range'));

// 1-4 — two instances: are references, filenames and media rows distinct?
range.addInstances();
range.addInstances();
captions(root)[0].setValue('ALPHA');
captions(root)[1].setValue('BETA');
report(root, 'STEP 1-4: two repeat instances created');
const referencesBefore = photos(root).map((n) => n.currentState.reference);
const filenamesBefore = referencesBefore.map(legacyNameFor);
console.log(`  references unique: ${new Set(referencesBefore).size === 2}`);
console.log(`  filenames unique:  ${new Set(filenamesBefore).size === 2}`);

// 5-8 — delete the first instance: does the survivor's identity move?
range.removeInstances(0, 1);
report(root, 'STEP 5-8: deleted repeat instance #1');
const survivorReference = photos(root)[0].currentState.reference;
console.log(`  survivor marker:  ${JSON.stringify(captions(root)[0]?.currentState?.value)} (BETA = the second item survived)`);
console.log(`  reference was:    ${referencesBefore[1]}`);
console.log(`  reference now:    ${survivorReference}`);
console.log(`  REFERENCE STABLE: ${survivorReference === referencesBefore[1]}`);
console.log(`  filename was:     ${filenamesBefore[1]}`);
console.log(`  filename now:     ${legacyNameFor(survivorReference)}`);
console.log(`  FILENAME STABLE:  ${legacyNameFor(survivorReference) === filenamesBefore[1]}`);
console.log(`  survivor now claims the DELETED item's filename: ${legacyNameFor(survivorReference) === filenamesBefore[0]}`);

// 9 — add another: uniqueness is restored, which is why nothing ever throws.
range.addInstances();
captions(root)[1].setValue('GAMMA');
report(root, 'STEP 9: added another repeat instance');
const referencesAfter = photos(root).map((n) => n.currentState.reference);
console.log(`  references unique now: ${new Set(referencesAfter).size === referencesAfter.length}`);
console.log(`  filenames unique now:  ${new Set(referencesAfter.map(legacyNameFor)).size === referencesAfter.length}`);
