// Installing a package onto a device: what lands, what is skipped, and what
// refuses. The store here is the real `gather-models` store over an in-memory
// file backend — packages do not get storage of their own, so the thing under
// test has to be the same store the app uses.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createModelRef, createModelStore, modelRevisionFor } from 'gather-models';

import { inspectComposition } from '../../src/authoring/inspectComposition.js';
import { installTool } from '../../src/packaging/installTool.js';
import { checkHostSupport, packTool } from '../../src/packaging/gatherPackage.js';
import { planPublication } from '../../src/packaging/publicationPlan.js';
import { createPackagedModelResolver } from '../../src/packaging/packagedModelResolver.js';
import { previewModels } from '../../apps/renderer/src/preview/previewModels.js';

const read = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const TOOL = JSON.parse(readFileSync(read(
  '../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json'), 'utf8'));
const capabilities = JSON.parse(readFileSync(read('../../apps/renderer/public/capabilities.json'), 'utf8')).capabilities;
const MODEL_DIR = read('../../apps/renderer/public/models/sha256-dcbe0ccd840f1290c3d4d9cc6e3071af0c3480751ef36fb861a9c757124cd55b');
const modelPackage = JSON.parse(readFileSync(`${MODEL_DIR}/model.json`, 'utf8'));
const artifactBytes = new Uint8Array(readFileSync(`${MODEL_DIR}/model.onnx`));
const REVISION = modelRevisionFor(modelPackage);

/** A device with nothing installed. */
const cleanDevice = () => {
  const values = new Map();
  const writes = [];
  const store = createModelStore({
    readBytes: async (key) => values.get(key),
    readText: async (key) => values.get(key),
    writeBytesAtomic: async (key, value) => { writes.push(key); values.set(key, value); },
    writeTextAtomic: async (key, value) => { writes.push(key); values.set(key, value); },
    fileExists: async (key) => values.has(key),
    fileForKey: (key) => ({ uri: `file:///documents/gather/${key}` }),
  });
  return { store, values, writes };
};

/** The smallest composition around a hand-built message list. */
const asComposition = (messages) =>
  Array.isArray(messages)
    ? { id: 'test.tool', catalogId: 'test', surfaceId: 'test', messages }
    : messages;

const analyse = (messages) =>
  inspectComposition({ composition: asComposition(messages), capabilities, models: previewModels });
const packFrom = (document, id) => {
  const plan = planPublication({ analysis: analyse(document), resolveDefault: () => null });
  return packTool({
    tool: { id, revision: '1', title: id },
    composition: { ...TOOL, messages: document },
    plan,
    modelSources: new Map([[REVISION, { modelPackage, artifactBytes }]]),
    builtAt: '2026-09-06T00:00:00.000Z',
  });
};

const canonical = () => packFrom(TOOL.messages, TOOL.id);
const install = (bytes, device) =>
  installTool({ bytes, modelStore: device.store, projectKey: 'p1', modelRevisionFor });

test('a clean device installs the packaged model and can resolve it afterwards', async () => {
  const device = cleanDevice();
  const { bytes } = canonical();
  const result = await install(bytes, device);

  assert.equal(result.models.length, 1);
  assert.equal(result.models[0].revision, REVISION);
  assert.equal(result.models[0].alreadyInstalled, false);
  assert.ok(result.models[0].descriptor.artifactPath.endsWith('model.onnx'));

  // Installed through the store's own layout, not a package-shaped one.
  const keys = [...device.values.keys()];
  const segment = REVISION.replace('sha256:', '');
  assert.ok(keys.some((key) => key === `projects/p1/models/${segment}/model.onnx`),
    `nothing landed in the store's layout: ${keys.join(', ')}`);
  assert.ok(!keys.some((key) => key.includes('.gather') || key.includes('package')),
    'the package must not create storage of its own');
});

test('installing the same package twice writes once', async () => {
  const device = cleanDevice();
  const { bytes } = canonical();

  const first = await install(bytes, device);
  const afterFirst = device.writes.length;
  const second = await install(bytes, device);

  assert.equal(first.models[0].alreadyInstalled, false);
  assert.equal(second.models[0].alreadyInstalled, true);
  assert.equal(device.writes.length, afterFirst, 'a repeat install rewrote the model');
  assert.deepEqual(second.models[0].descriptor, first.models[0].descriptor);
});

test('two different Tools sharing a model install its bytes once', async () => {
  const device = cleanDevice();
  // A second Tool, same model. Only the identity differs, which is the case
  // that matters: dedupe is by content revision, not by who shipped it.
  const other = JSON.parse(JSON.stringify(TOOL.messages));
  const a = await install(canonical().bytes, device);
  const writesAfterA = device.writes.length;
  const b = await install(packFrom(other, 'gather.other-tool').bytes, device);

  assert.equal(a.models[0].alreadyInstalled, false);
  assert.equal(b.models[0].alreadyInstalled, true);
  assert.equal(device.writes.length, writesAfterA, 'the shared model was stored twice');
  assert.notEqual(a.manifest.tool.id, b.manifest.tool.id, 'these must be two distinct Tools');
});

test('a corrupt package installs nothing at all', async () => {
  const device = cleanDevice();
  const { bytes } = canonical();
  const damaged = Uint8Array.from(bytes);
  damaged[damaged.byteLength - 200] ^= 0xff; // inside the model artifact

  await assert.rejects(() => install(damaged, device));
  assert.equal(device.writes.length, 0, 'a failed verification left files behind');
});

test('a missing Capability and a missing host function do not look like a missing model', async () => {
  const device = cleanDevice();
  const { manifest } = canonical();
  await install(canonical().bytes, device);

  // The model is installed and resolvable; the host still cannot run the Tool,
  // and each reason has to name itself. Reporting "model unavailable" for a
  // host that simply lacks `measure.area` sends someone to re-download bytes
  // they already have.
  const noCapability = checkHostSupport({
    manifest,
    capabilities: ['image.segment'],
    hostFunctions: ['gather_persistAsset', 'gather_completeComposition'],
  });
  assert.equal(noCapability.supported, false);
  assert.deepEqual(noCapability.missing, [{ kind: 'capability', id: 'measure.area' }]);

  const noHostFunction = checkHostSupport({
    manifest,
    capabilities: ['image.segment', 'measure.area'],
    hostFunctions: ['gather_persistAsset'],
  });
  assert.equal(noHostFunction.supported, false);
  assert.deepEqual(noHostFunction.missing, [{ kind: 'hostFunction', id: 'gather_completeComposition' }]);

  const runnable = checkHostSupport({
    manifest,
    capabilities: ['image.segment', 'measure.area'],
    hostFunctions: ['gather_persistAsset', 'gather_completeComposition'],
  });
  assert.deepEqual(runnable, { supported: true, missing: [] });
});

/**
 * The canonical Tool names its model explicitly, so it freezes no defaults.
 * This variant drops the `modelRef` argument, which is the case where the
 * question "which model runs?" is answered by policy at authoring time and must
 * stop being answered by policy afterwards.
 */
const defaultingTool = () => {
  const document = JSON.parse(JSON.stringify(TOOL.messages));
  let dropped = false;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.functionCall?.call === 'image_segment' && node.functionCall.args?.modelRef) {
      delete node.functionCall.args.modelRef;
      dropped = true;
    }
    Object.values(node).forEach(walk);
  };
  walk(document);
  assert.ok(dropped, 'the fixture no longer contains the bound modelRef it edits');
  return document;
};

test('a package with an omitted modelRef freezes what policy said at build time', async () => {
  const device = cleanDevice();
  const document = defaultingTool();
  const plan = planPublication({
    analysis: analyse(document),
    resolveDefault: () => createModelRef(modelPackage),
  });
  const { bytes, manifest } = packTool({
    tool: { id: 'gather.defaulting-tool', revision: '1', title: 'Defaulting' },
    composition: { ...TOOL, messages: document },
    plan,
    modelSources: new Map([[REVISION, { modelPackage, artifactBytes }]]),
    builtAt: '2026-09-06T00:00:00.000Z',
  });
  assert.deepEqual(manifest.modelResolutions.map((entry) => entry.capability), ['image.segment']);

  const installed = await install(bytes, device);

  // The wrapped resolver still does the store lookup; what it is never allowed
  // to do is *choose*. It is handed the frozen ref, so a default that has since
  // moved on cannot change what this package runs.
  const asked = [];
  const resolver = createPackagedModelResolver({
    manifest: installed.manifest,
    resolve: async (input) => {
      assert.ok(input.modelRef, 'the resolver was asked to pick a model itself');
      asked.push(input.modelRef.revision);
      return device.store.resolve({ projectKey: 'p1', modelRef: input.modelRef });
    },
  });

  const resolved = await resolver({ capabilityId: 'image.segment' });
  assert.deepEqual(asked, [REVISION]);
  assert.equal(resolved.modelRef.revision, REVISION);

  // A capability the package froze nothing for is not quietly handed to policy
  // either: a package that cannot answer says so.
  await assert.rejects(() => resolver({ capabilityId: 'image.classify' }),
    (error) => error.code === 'GATHER_PACKAGED_RESOLUTION_MISSING');
  assert.deepEqual(asked, [REVISION], 'the wrapped resolver was consulted anyway');
});

test('a Tool that relies on a default cannot be packaged without freezing one', () => {
  assert.throws(
    () => planPublication({ analysis: analyse(defaultingTool()), resolveDefault: () => null }),
    (error) => error.code === 'GATHER_PUBLISH_NO_DEFAULT'
  );
});

test('the canonical Tool names its model, so it freezes no defaults at all', () => {
  const { manifest } = canonical();
  assert.deepEqual(manifest.modelResolutions, [],
    'an explicitly bound model is a dependency, not a frozen default');
});
