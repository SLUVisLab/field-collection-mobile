/**
 * A `.gather` package, end to end: pack it here, install it there, run it.
 *
 * ```text
 * canonical Tool source
 *   → inspectComposition()   what it actually calls
 *   → planPublication()      what it therefore requires
 *   → packTool()             deterministic archive
 *   → installTool()          through gather-models, in the browser
 *   → RENDER_A2UI            the composition read *from the archive*
 *   → real ORT-Web inference on the frozen revision
 *   → a real area
 * ```
 *
 * This is Gather's one rehearsal. The point of running it in the preview rather
 * than in Node is that there is no package execution runtime and there must not
 * be one: a packaged composition renders through the same bridge, the same
 * catalog and the same Capability functions as a draft, and the only thing the
 * package changes is where the model bytes came from.
 *
 * What is **not** asserted here, because it needs no browser and is covered in
 * test/packaging/: that the plan freezes exactly what the Tool requires, that
 * two packs of the same Tool give identical bytes, that nothing about a form or
 * a Central project travels in the archive, and that a corrupted byte is
 * refused before anything is installed. Packing happens below only to produce
 * the bytes this rehearsal installs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { canonicalize } from 'gather-hashing';
import { modelRevisionFor } from 'gather-models';

import { inspectComposition } from '../../src/authoring/inspectComposition.js';
import { packTool } from '../../src/packaging/gatherPackage.js';
import { planPublication } from '../../src/packaging/publicationPlan.js';
import { previewModels } from '../../apps/renderer/src/preview/previewModels.js';

import { expect, test } from '../support/preview.mjs';
import {
  chooseSampleImage,
  fidelityLedger,
  instrumentText,
  openBridgeHost,
  press,
  rendererFrame,
} from '../support/bridgeHost.mjs';

const read = (relative) => fileURLToPath(new URL(relative, import.meta.url));

const TOOL = JSON.parse(
  readFileSync(
    read('../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json'),
    'utf8'
  )
);
const capabilities = JSON.parse(
  readFileSync(read('../../apps/renderer/public/capabilities.json'), 'utf8')
).capabilities;
const MODEL_DIR = read(
  '../../apps/renderer/public/models/sha256-dcbe0ccd840f1290c3d4d9cc6e3071af0c3480751ef36fb861a9c757124cd55b'
);
const modelPackage = JSON.parse(readFileSync(`${MODEL_DIR}/model.json`, 'utf8'));
const artifactBytes = new Uint8Array(readFileSync(`${MODEL_DIR}/model.onnx`));
const REVISION = modelRevisionFor(modelPackage);

/** The archive this rehearsal installs. Packing is setup, not the subject. */
const packageBytes = () => {
  const analysis = inspectComposition({ composition: TOOL, capabilities, models: previewModels });
  const plan = planPublication({ analysis, resolveDefault: () => null });
  return packTool({
    tool: { id: TOOL.id, revision: TOOL.revision, title: TOOL.title },
    composition: TOOL,
    plan,
    modelSources: new Map([[REVISION, { modelPackage, artifactBytes }]]),
    builtAt: '2026-09-06T00:00:00.000Z',
  }).bytes;
};

/** Installs an archive through the preview's own model store. */
const installInBrowser = (frame, bytes) =>
  frame.evaluate(async (base64) => {
    const binary = atob(base64);
    const packaged = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) packaged[index] = binary.charCodeAt(index);
    const result = await window.__gatherPreview.installPackage(packaged);
    return {
      composition: result.composition,
      models: result.models.map((m) => ({
        revision: m.revision,
        alreadyInstalled: m.alreadyInstalled,
      })),
      installedRevisions: window.__gatherPreview.installedModels(),
    };
  }, Buffer.from(bytes).toString('base64'));

test.setTimeout(300000);

test('a packaged Tool installs into a clean browser and runs on the revision it froze', async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const bytes = packageBytes();

  await openBridgeHost(page);
  const frame = await rendererFrame(page);

  let installed;
  await test.step('install the archive through the preview model store', async () => {
    installed = await installInBrowser(frame, bytes);

    expect(
      installed.models[0]?.alreadyInstalled,
      'a clean preview must install the model, not find it already there'
    ).toBe(false);
    expect(installed.installedRevisions).toContain(REVISION);
  });

  await test.step('the archive yields the whole composition a device could load', async () => {
    // Content, not byte order. The packer canonicalizes on the way in — sorted
    // keys are what make two packs of the same Tool identical — so the archived
    // document differs from the source file in key order and in nothing else.
    expect(canonicalize(installed.composition)).toBe(canonicalize(TOOL));
    expect(typeof installed.composition.id).toBe('string');
    expect(typeof installed.composition.catalogId).toBe('string');
    expect(installed.composition.result.outputs).toHaveLength(5);
  });

  await test.step('installing it again installs nothing again', async () => {
    const again = await installInBrowser(frame, bytes);
    expect(again.models[0]?.alreadyInstalled).toBe(true);
  });

  await test.step('render the composition that came out of the archive', async () => {
    // The ordinary bridge message. There is no packaged-Tool code path.
    await page.evaluate(
      (messages) => window.__send({ type: 'RENDER_A2UI', payload: messages }),
      installed.composition.messages
    );
    // The node exists before it has anything in it, so wait for the content.
    await frame.waitForFunction(
      () => (document.querySelector('.gather-instrument-content')?.innerText.trim() ?? '').length > 0,
      null,
      { timeout: 60000 }
    );
    expect(await instrumentText(frame)).toContain('Segment and measure');
  });

  await test.step('run it: real inference on the frozen model', async () => {
    await chooseSampleImage(frame);
    await press(frame, 'Save photo', 'gather_persistAsset', 30000);
    await press(frame, 'Segment', 'image_segment');

    const ledger = await fidelityLedger(frame);
    expect(ledger, ledger.slice(0, 110)).toMatch(/image_segment\s*real/i);
    expect(ledger, 'a drawn mask would satisfy everything else here').toMatch(/onnxruntime-web/);

    await press(frame, 'Measure area', 'measure_', 30000);
    const shown = await instrumentText(frame);
    expect(shown.match(/\b(\d{4,})\b/)?.[1], `no measurement in: ${shown.slice(0, 90)}`).toBeTruthy();
  });

  await test.step('the Tool reports the exact revision the package froze', async () => {
    // The assertion the whole design exists to make true.
    const reported = await instrumentText(frame);
    expect(
      reported.includes(REVISION) || reported.includes(REVISION.slice(7, 19)),
      reported.slice(0, 160)
    ).toBe(true);
  });

  await page.close();
});
