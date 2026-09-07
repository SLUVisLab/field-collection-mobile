/**
 * Emits the web projection of the Gather Model Catalog.
 *
 * Models stay a **distinct Gather concept**, beside Components and
 * Capabilities — not an A2UI Component, not an A2UI Function, and not
 * something an A2UI function schema owns. The wrapper and any future plugin
 * authoring environment consume this file; the Composer never sees it, which
 * is why it needs no upstream patch.
 *
 * It is generated rather than written, from the same `buildModelCatalog` the
 * app uses, so a model added to `bundledModels` appears here without anyone
 * editing a second list. It runs under Node at build time because
 * `bundledModels` reaches its artifacts through React Native `require()`
 * handles that mean nothing in a browser — the catalog's *metadata* is
 * portable, its byte handles are not.
 *
 *   node scripts/generate-model-catalog.mjs
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CAPABILITY_DEFINITIONS, functionNameFor } from 'gather-capabilities';
import { validateModelPackage } from 'gather-models';

import { bundledModelForRef } from '../../../src/compute/models/modelPolicy.js';
import { buildModelCatalog } from '../../../src/compute/models/modelCatalog.js';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../public/models.json');

// No `installed` list: installation is device state, and the web preview has no
// device. Absence changes which entries are *annotated* as present, never which
// are offered — see modelCatalog.js.
const catalog = buildModelCatalog();

/**
 * Structural validity is decided **here**, by the authority that holds the real
 * `ModelPackage`, and carried as a fact. The web projection deliberately does
 * not include the package itself, so re-deriving this in a browser would mean
 * validating a partial copy — which is worse than not validating.
 */
const structuralityOf = (modelRef) => {
  const declared = bundledModelForRef(modelRef);
  if (!declared?.modelPackage) {
    return { valid: false, problem: 'This distribution declares no package for this revision.' };
  }
  try {
    validateModelPackage(declared.modelPackage);
    return { valid: true, problem: null };
  } catch (error) {
    return { valid: false, problem: error.message };
  }
};

const projection = {
  // Stamped so a stale file in a container is recognisable as stale.
  generatedAt: new Date().toISOString(),
  source: 'gather/src/compute/models/modelCatalog.js',
  models: catalog.map((entry) => ({
    modelRef: entry.modelRef,
    displayName: entry.displayName,
    taskProfile: entry.taskProfile,
    upstream: entry.upstream,
    tensor: entry.tensor,
    requiresLabels: entry.requiresLabels,
    source: entry.source,
    defaultFor: entry.defaultFor,
    structural: structuralityOf(entry.modelRef),
  })),
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(projection, null, 2)}\n`);

/**
 * The Capability projection, beside the Model one and for the same reason: the
 * wrapper needs Capability *semantics* to analyze a Tool, and it should get
 * them as data rather than by keeping its own list. `takesModelRef` is what
 * tells an authoring UI which calls have a model to choose at all.
 */
const capabilities = {
  generatedAt: projection.generatedAt,
  source: 'gather/packages/gather-capabilities',
  capabilities: CAPABILITY_DEFINITIONS.map((definition) => ({
    id: definition.id,
    functionName: functionNameFor(definition.id),
    acceptedModelProfiles: definition.acceptedModelProfiles ?? [],
    takesModelRef: Boolean(definition.input?._def?.shape?.().modelRef),
  })),
};
const capabilitiesOut = resolve(here, '../public/capabilities.json');
writeFileSync(capabilitiesOut, `${JSON.stringify(capabilities, null, 2)}\n`);
console.log(`capabilities.json  ${capabilities.capabilities.length} capabilities, ` +
  `${capabilities.capabilities.filter((c) => c.takesModelRef).length} model-backed`);
console.log(`models.json  ${projection.models.length} models`);
for (const model of projection.models) {
  console.log(
    `  ${model.modelRef.id.padEnd(34)} ${model.taskProfile.padEnd(26)}` +
      `${model.defaultFor.length ? 'default for ' + model.defaultFor.join(', ') : ''}`
  );
}

/**
 * Gather's authoring analysis, served for the wrapper.
 *
 * `inspectComposition`, `setModelSelection` and `compatibilityFor` are Gather domain
 * logic — they encode Capability and ModelRef semantics, so they belong here
 * rather than being reimplemented in the web repo. They are dependency-free ES
 * modules, so serving them is a copy.
 *
 * The wrapper imports them across origins, which is deliberate: the renderer is
 * Gather's web surface, and this is the same channel that already carries
 * models.json and capabilities.json. A cross-repo build context would be the
 * alternative, and it would make neither repository buildable alone.
 */
/** Changes when what the wrapper reads changes, so skew is detectable. */
const digestOfCatalogs = () =>
  createHash('sha256')
    .update(JSON.stringify(projection.models))
    .update(JSON.stringify(capabilities.capabilities))
    .digest('hex')
    .slice(0, 12);

const authoringOut = resolve(here, '../public/authoring');
const authoringSrc = resolve(here, '../../../src/authoring');
mkdirSync(authoringOut, { recursive: true });
const copied = readdirSync(authoringSrc).filter((name) => name.endsWith('.js'));
for (const name of copied) {
  copyFileSync(resolve(authoringSrc, name), resolve(authoringOut, name));
}

/**
 * Composition binding, served the same way and for the same reason.
 *
 * Which groups are composition slots, and where a Tool's outputs land inside
 * one, are Gather semantics. The wrapper needs both to show a researcher where
 * a Tool's results will go, and a second copy of these rules in the web repo
 * would drift the way every previous duplicate did.
 *
 * Named explicitly rather than copied by directory: `src/xforms/compositions/`
 * also holds the engine control, the commit path and the handler registry, none
 * of which is browser-safe or any of the wrapper's business. These three are,
 * and `compositionBinding.js` imports `./recognition.js` relatively — so they
 * are copied into a subdirectory together and that import still resolves.
 */
const COMPOSITION_EXPORTS = ['recognition.js', 'compositionBinding.js', 'formStructure.js'];
const compositionsOut = resolve(authoringOut, 'compositions');
const compositionsSrc = resolve(here, '../../../src/xforms/compositions');
mkdirSync(compositionsOut, { recursive: true });
for (const name of COMPOSITION_EXPORTS) {
  copyFileSync(resolve(compositionsSrc, name), resolve(compositionsOut, name));
}

/**
 * Publication planning, for the Review panel's package readiness.
 *
 * `planPublication` is the function that decides whether a Tool *could* be
 * packaged: whether every model call resolves to an exact revision, and what
 * the dependency closure therefore is. Review reports readiness, so it must ask
 * the thing that would actually do the packing rather than reimplementing its
 * judgement — a second answer to "is this publishable?" is a second answer that
 * can disagree with `packTool`.
 *
 * `planPublication` alone has no imports, but `packTool` reaches
 * `gather-hashing` → `js-sha256`, which ships no ESM build. So packaging is not
 * copied as source like the modules above: `vite.pack.config.js` emits a
 * self-contained `packaging/gatherPack.js` carrying both, and the directory is
 * only created here. One module, so a raw copy cannot drift from a bundled one.
 */
mkdirSync(resolve(authoringOut, 'packaging'), { recursive: true });

/**
 * First-party Tools, served so the Composer has something to open.
 *
 * A Composer whose Library is empty on first run asks a researcher to author an
 * A2UI document from nothing, which is not a thing anyone can do. These are the
 * compositions this repository already ships — the same artifacts the device
 * runs — so a starter Tool is a real Tool, not a tutorial fixture that drifts
 * from the real ones.
 *
 * Whole compositions, not message lists: `result` is what makes a Tool's
 * declared output types checkable, and a starter without it would seed a Library
 * full of Tools that cannot be reviewed.
 */
const startersOut = resolve(authoringOut, 'starters');
mkdirSync(startersOut, { recursive: true });
const compositionsDir = resolve(here, '../../../compositions');
const starters = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.a2ui.json')) starters.push(full);
  }
};
walk(compositionsDir);

const starterIndex = starters
  .map((file) => {
    const composition = JSON.parse(readFileSync(file, 'utf8'));
    copyFileSync(file, resolve(startersOut, `${composition.id}.json`));
    return {
      id: composition.id,
      title: composition.title ?? composition.id,
      description: composition.description ?? null,
      revision: composition.revision ?? null,
      outputs: (composition.result?.outputs ?? []).length,
      file: `${composition.id}.json`,
    };
  })
  .sort((a, b) => (a.id < b.id ? -1 : 1));

writeFileSync(
  resolve(startersOut, 'index.json'),
  `${JSON.stringify({ starters: starterIndex }, null, 2)}\n`
);
console.log(`authoring/starters/      ${starterIndex.map((s) => s.id).join(', ')}`);

/**
 * The manifest makes this a **contract** rather than incidental static files.
 *
 * The wrapper and the renderer deploy independently, so a newer wrapper can
 * meet an older renderer. Without a declared version that shows up as a subtly
 * wrong UI — the failure mode this project keeps designing against — so the
 * wrapper checks `apiVersion` before importing anything and refuses loudly on a
 * mismatch.
 *
 * Bump `AUTHORING_API_VERSION` when an export's *contract* changes: a removed
 * function, a renamed field a caller reads, or a changed meaning. Adding a
 * field callers may ignore does not need one.
 */
const AUTHORING_API_VERSION = 6;

/**
 * The revision this renderer was built from.
 *
 * Supplied by the build rather than discovered by running Git inside the image,
 * because the image has no repository and the honest answer there was
 * "unknown" — a field nobody can trust is worse than no field. Outside a
 * deployment, a clearly marked development value keeps local work possible
 * without pretending to be a release.
 */
const revisionOf = () => {
  const supplied = process.env.GATHER_REVISION?.trim();
  if (supplied) return supplied;
  try {
    return `dev-${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()}`;
  } catch {
    return 'dev-unknown';
  }
};
writeFileSync(
  resolve(authoringOut, 'manifest.json'),
  `${JSON.stringify(
    {
      apiVersion: AUTHORING_API_VERSION,
      rendererRevision: revisionOf(),
      catalogRevision: digestOfCatalogs(),
      exports: [
        'inspectComposition',
        'setModelSelection',
        'compatibilityFor',
        'previewEvidence',
        'readCompositionSlots',
        'bindCompositionOutputs',
        'planPublication',
        // v5: inspectComposition accepts a whole composition and reports its
        // declared `result`. A wrapper that expects types from a renderer too
        // old to report them would show "not declared" for a Tool that does —
        // silently wrong, which is what the version exists to prevent.
        // v6: the parameter is `composition`, and a message list is refused.
        'inspectComposition(composition)',
      ],
      generatedAt: projection.generatedAt,
    },
    null,
    2
  )}\n`
);
console.log(`authoring/         api v${AUTHORING_API_VERSION}, ${copied.join(', ')}`);
console.log(`authoring/compositions/  ${COMPOSITION_EXPORTS.join(', ')}`);
console.log('authoring/packaging/     gatherPack.js (built by vite.pack.config.js)');
