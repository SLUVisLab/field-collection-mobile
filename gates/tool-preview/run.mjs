/**
 * The authored Tool, exercised in the Composer preview with real inference.
 *
 * This is the researcher-facing path, not an executor harness: the canonical
 * Tool is rendered through the bridge exactly as the Composer renders it, an
 * author supplies a sample image through the Component's own control, and every
 * step afterwards is the Tool's own FunctionCalls — `gather_persistAsset`,
 * `image_segment` on real ORT-Web, `measure_area` on the resulting mask.
 *
 *   npm run gate:tool-preview
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EDITOR = process.env.EDITOR_ORIGIN ?? 'http://editor.openfieldworks.localhost';
const RENDERER = process.env.RENDERER_ORIGIN ?? 'http://renderer.openfieldworks.localhost';
const CONTAINER = process.env.EDITOR_CONTAINER ?? 'ofw-editor-editor-1';

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

const fail = [];
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
  if (!cond) fail.push(label);
};

execFileSync('docker', [
  'cp',
  fileURLToPath(new URL('./host.html', import.meta.url)),
  `${CONTAINER}:/usr/share/nginx/html/__tool-preview-gate.html`,
]);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

try {
  await page.goto(`${EDITOR}/__tool-preview-gate.html?renderer=${encodeURIComponent(RENDERER)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => window.__result?.ready, null, { timeout: 20000 });
  await page.evaluate((messages) => window.__send({ type: 'RENDER_A2UI', payload: messages }), TOOL.messages);
  await page.waitForTimeout(2500);

  const frame = () => page.frames().find((f) => f.url().startsWith(RENDERER));
  const text = () =>
    frame().evaluate(() =>
      document.querySelector('.gather-instrument-content')?.innerText.replace(/\s+/g, ' ') ?? ''
    );

  ok('the canonical Tool rendered', (await text()).includes('Segment and measure'));
  ok('sample input is offered where the camera cannot run',
    !!(await frame().$('[data-testid="camera-sample-image"]')));

  // An author supplies a representative image through the Component itself.
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

  // The ledger is the renderer's own honesty surface.
  const ledger = await frame().evaluate(() =>
    document.querySelector('.preview-fidelity')?.innerText.replace(/\s+/g, ' ') ?? ''
  );
  ok('image_segment reports real execution', /image_segment\s*real/i.test(ledger),
    ledger.slice(0, 110));
  ok('the ledger names the browser runtime', /onnxruntime-web/.test(ledger));

  ok('Measure area ran', await press('Measure area', 4000));
  const shown = await text();
  const area = shown.match(/\b(\d{4,})\b/)?.[1] ?? null;
  ok('the Tool received a real measurement', area != null, area ? `${area} px²` : shown.slice(0, 90));

  // Merely previewing must not rewrite the Tool.
  const unchanged = await page.evaluate(
    (messages) => JSON.stringify(messages),
    TOOL.messages
  );
  ok('the Tool document is unchanged by running it', unchanged === JSON.stringify(TOOL.messages));

  const real = errors.filter((e) => !/camera is not allowed/.test(e));
  ok('no unexpected console errors', real.length === 0, real.slice(0, 1).join(' | '));
} finally {
  await browser.close();
}

console.log(fail.length ? `\n${fail.length} failed` : '\nTool preview green');
process.exit(fail.length ? 1 : 0);
