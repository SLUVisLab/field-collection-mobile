/**
 * The authored Tool, executed in the Composer preview with real inference.
 *
 * This is the researcher-facing path rather than an executor harness: the
 * canonical Tool is rendered through the bridge exactly as the Composer renders
 * it, an author supplies a sample image through the Component's own control,
 * and every step afterwards is the Tool's own FunctionCalls —
 * `gather_persistAsset`, `image_segment` on real ORT-Web, `measure_area` on the
 * resulting mask.
 *
 * What the catalog *advertises* is not checked here; that is a projection and
 * is unit-tested in test/renderer/preview-catalog.test.mjs. What cannot be
 * checked anywhere else is that pressing the buttons in order actually
 * produces a number.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '../support/preview.mjs';
import {
  RENDERER_OUTBOUND,
  chooseSampleImage,
  fidelityLedger,
  instrumentText,
  openBridgeHost,
  press,
  renderThroughBridge,
} from '../support/bridgeHost.mjs';

const TOOL = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json',
        import.meta.url
      )
    ),
    'utf8'
  )
);

test.describe.configure({ mode: 'serial' });

test.describe('Running the canonical Tool in the preview', () => {
  let page;
  let frame;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    await openBridgeHost(page);
    frame = await renderThroughBridge(page, TOOL.messages);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('the Tool renders, and offers sample input where no camera can run', async () => {
    expect(await instrumentText(frame)).toContain('Segment and measure');
    expect(
      await frame.$('[data-testid="camera-sample-image"]'),
      'a browser preview has no camera, so a Tool that only offers one cannot be tried'
    ).not.toBeNull();
  });

  test('saving, segmenting and measuring produce a real measurement', async () => {
    await chooseSampleImage(frame);

    await press(frame, 'Save photo', 'gather_persistAsset', 30000);
    await press(frame, 'Segment', 'image_segment');

    const ledger = await fidelityLedger(frame);
    expect(ledger, ledger.slice(0, 110)).toMatch(/image_segment\s*real/i);
    expect(ledger, 'the ledger names the runtime that actually ran').toMatch(/onnxruntime-web/);

    await press(frame, 'Measure area', 'measure_', 30000);
    const shown = await instrumentText(frame);
    expect(
      shown.match(/\b(\d{4,})\b/)?.[1],
      `no measurement in: ${shown.slice(0, 90)}`
    ).toBeTruthy();
  });

  test('running a Tool never asks the host to change the Tool', async () => {
    // The previous version of this compared the composition to itself — it
    // serialised the argument it had just been handed and asserted the result
    // equalled that argument, which cannot fail. What it meant to say is this:
    // a renderer's whole outbound vocabulary is readiness, catalog, data-model
    // changes and actions. None of them edits the document.
    const inbound = await page.evaluate(() => window.__result.inbound);

    expect(inbound.length, 'the renderer said nothing at all').toBeGreaterThan(0);
    const undeclared = [...new Set(inbound)].filter((type) => !RENDERER_OUTBOUND.has(type));
    expect(undeclared, `undeclared messages from the renderer: ${undeclared.join(', ')}`).toEqual([]);
  });
});
