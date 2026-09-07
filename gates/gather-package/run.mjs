/**
 * A `.gather` package, end to end: pack it here, install it there, run it.
 *
 *   canonical Tool source
 *     → inspectComposition()          what it actually calls
 *     → planPublication()      what it therefore requires
 *     → packTool()             deterministic archive
 *     → installTool()          through gather-models, in the browser
 *     → RENDER_A2UI            the composition read *from the archive*
 *     → real ORT-Web inference on the frozen revision
 *     → a real area
 *
 * The point of running this in the preview rather than in Node is that there is
 * no package execution runtime and there must not be one. A packaged
 * composition renders through the same bridge, the same catalog and the same
 * capability functions as a draft; the only thing the package changes is where
 * the model bytes came from.
 *
 *   npm run gate:gather-package
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { canonicalize } from 'gather-hashing';
import { modelRevisionFor } from 'gather-models';

import { inspectComposition } from '../../src/authoring/inspectComposition.js';
import { packTool } from '../../src/packaging/gatherPackage.js';
import { planPublication } from '../../src/packaging/publicationPlan.js';
import { previewModels } from '../../apps/renderer/src/preview/previewModels.js';

const EDITOR = process.env.EDITOR_ORIGIN ?? 'http://editor.openfieldworks.localhost';
const RENDERER = process.env.RENDERER_ORIGIN ?? 'http://renderer.openfieldworks.localhost';
const CONTAINER = process.env.EDITOR_CONTAINER ?? 'ofw-editor-editor-1';

const read = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const TOOL = JSON.parse(readFileSync(read(
  '../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json'), 'utf8'));
const capabilities = JSON.parse(readFileSync(read('../../apps/renderer/public/capabilities.json'), 'utf8')).capabilities;
const MODEL_DIR = read('../../apps/renderer/public/models/sha256-dcbe0ccd840f1290c3d4d9cc6e3071af0c3480751ef36fb861a9c757124cd55b');
const modelPackage = JSON.parse(readFileSync(`${MODEL_DIR}/model.json`, 'utf8'));
const artifactBytes = new Uint8Array(readFileSync(`${MODEL_DIR}/model.onnx`));
const REVISION = modelRevisionFor(modelPackage);

const fail = [];
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
  if (!cond) fail.push(label);
};

// ---- authoring side -------------------------------------------------------

const analysis = inspectComposition({ composition: TOOL, capabilities, models: previewModels });
const plan = planPublication({ analysis, resolveDefault: () => null });
const { bytes, manifest } = packTool({
  tool: { id: TOOL.id, revision: TOOL.revision, title: TOOL.title },
  composition: TOOL,
  plan,
  modelSources: new Map([[REVISION, { modelPackage, artifactBytes }]]),
  builtAt: '2026-09-06T00:00:00.000Z',
});

ok('the plan froze exactly one model', manifest.requires.models.length === 1, REVISION);
ok('the package carries the model bytes', bytes.byteLength > artifactBytes.byteLength,
  `${(bytes.byteLength / 1e6).toFixed(2)} MB`);

// A package is portable or it is not a package. Nothing that ties this Tool to
// one Central deployment, one form, or one XForms binding may travel with it.
const raw = Buffer.from(bytes).toString('latin1');
for (const forbidden of ['projectId', 'formId', 'compositionBinding', '/data/', 'gather_m10_vertical_slice', '.xml']) {
  ok(`the package carries no ${forbidden}`, !raw.includes(forbidden));
}

// ---- device side ----------------------------------------------------------

execFileSync('docker', ['cp', read('./host.html'), `${CONTAINER}:/usr/share/nginx/html/__gather-package-gate.html`]);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

try {
  await page.goto(`${EDITOR}/__gather-package-gate.html?renderer=${encodeURIComponent(RENDERER)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => window.__result?.ready, null, { timeout: 20000 });
  const frame = () => page.frames().find((f) => f.url().startsWith(RENDERER));

  // Install. The archive arrives as bytes and nothing else — no side channel
  // tells the renderer which Tool this is or where its model lives.
  const installed = await frame().evaluate(async (base64) => {
    const binary = atob(base64);
    const packaged = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) packaged[index] = binary.charCodeAt(index);
    try {
      const result = await window.__gatherPreview.installPackage(packaged);
      return {
        composition: result.composition,
        manifest: result.manifest,
        models: result.models.map((m) => ({ revision: m.revision, alreadyInstalled: m.alreadyInstalled })),
        installedRevisions: window.__gatherPreview.installedModels(),
      };
    } catch (error) {
      return { error: `${error.code ?? error.name}: ${error.message}` };
    }
  }, Buffer.from(bytes).toString('base64'));

  ok('the package opened and installed', !installed.error, installed.error ?? '');
  if (installed.error) throw new Error(installed.error);

  ok('a clean preview installed the model rather than finding it',
    installed.models[0]?.alreadyInstalled === false);
  ok('the model store now holds the frozen revision',
    installed.installedRevisions.includes(REVISION), installed.installedRevisions.join(', '));
  // Content, not byte order. The packer canonicalizes on the way in — sorted
  // keys are what make two packs of the same Tool identical — so the archived
  // document differs from the source file in key order and in nothing else.
  ok('the composition came back from the archive unchanged',
    canonicalize(installed.composition) === canonicalize(TOOL));
  ok('and it is the whole composition a device could load, not just its messages',
    typeof installed.composition?.id === 'string' &&
    typeof installed.composition?.catalogId === 'string' &&
    Array.isArray(installed.composition?.messages) &&
    (installed.composition?.result?.outputs ?? []).length === 5,
    `${(installed.composition?.result?.outputs ?? []).length} declared outputs`);

  // Installing twice must not install twice.
  const again = await frame().evaluate(async (base64) => {
    const binary = atob(base64);
    const packaged = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) packaged[index] = binary.charCodeAt(index);
    const result = await window.__gatherPreview.installPackage(packaged);
    return result.models.map((m) => m.alreadyInstalled);
  }, Buffer.from(bytes).toString('base64'));
  ok('reinstalling the same package is a no-op', again[0] === true);

  // ---- execution ----------------------------------------------------------
  // The composition that renders is the object the archive yielded, sent
  // through the ordinary bridge message. There is no packaged-Tool code path
  // below this line.
  await page.evaluate((composition) => window.__send({ type: 'RENDER_A2UI', payload: composition }),
    installed.composition.messages);
  await page.waitForTimeout(2500);

  const text = () => frame().evaluate(() =>
    document.querySelector('.gather-instrument-content')?.innerText.replace(/\s+/g, ' ') ?? '');

  ok('the packaged Tool rendered', (await text()).includes('Segment and measure'));

  await frame().evaluate(async () => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = '#101014'; context.fillRect(0, 0, size, size);
    context.fillStyle = '#f5b301';
    context.beginPath(); context.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2); context.fill();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const input = document.querySelector('input[type="file"]');
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'sample.png', { type: 'image/png' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1200);

  const press = async (label, waitMs) => {
    const button = await frame().$(`button:has-text("${label}")`);
    if (!button) return false;
    await button.click();
    await page.waitForTimeout(waitMs);
    return true;
  };

  ok('Save photo ran', await press('Save photo', 1500));
  ok('Segment ran', await press('Segment', 30000));

  const ledger = await frame().evaluate(() =>
    document.querySelector('.preview-fidelity')?.innerText.replace(/\s+/g, ' ') ?? '');
  ok('segmentation was real inference, not a drawn mask', /image_segment\s*real/i.test(ledger),
    ledger.slice(0, 110));
  ok('it ran on the browser ONNX runtime', /onnxruntime-web/.test(ledger));

  ok('Measure area ran', await press('Measure area', 4000));
  const shown = await text();
  const area = shown.match(/\b(\d{4,})\b/)?.[1] ?? null;
  ok('the packaged Tool produced a real measurement', area != null,
    area ? `${area} px²` : shown.slice(0, 90));

  // The identity the Tool reports has to be the revision the package froze —
  // this is the assertion the whole design exists to make true.
  const reported = await frame().evaluate(() => {
    const model = document.querySelector('.gather-instrument-content')?.innerText ?? '';
    return model.replace(/\s+/g, ' ');
  });
  ok('the Tool reports the frozen revision it ran',
    reported.includes(REVISION) || reported.includes(REVISION.slice(7, 19)),
    reported.slice(0, 160));

  const real = errors.filter((e) => !/camera is not allowed/.test(e));
  ok('no unexpected console errors', real.length === 0, real.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}

console.log(fail.length ? `\n${fail.length} failed` : '\n.gather package gate green');
process.exit(fail.length ? 1 : 0);
