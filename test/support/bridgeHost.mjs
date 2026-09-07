/**
 * The A2UI Composer's side of the bridge, reproduced for tests.
 *
 * `bridge-host.html` is a sandboxed iframe plus the documented `?origin=`
 * pairing contract and the five-message protocol — nothing Gather-specific
 * except the composition it is asked to render. It is served *from the editor's
 * origin*, because framing the renderer from anywhere else is a different test:
 * the renderer's `frame-ancestors` is the thing that would refuse.
 *
 * There used to be three byte-identical copies of that file, one per gate. This
 * is one.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const EDITOR = process.env.EDITOR_ORIGIN ?? 'http://editor.openfieldworks.localhost';
export const RENDERER = process.env.RENDERER_ORIGIN ?? 'http://renderer.openfieldworks.localhost';
const CONTAINER = process.env.EDITOR_CONTAINER ?? 'ofw-editor-editor-1';

/** Copies the harness into the running editor and returns the URL to open. */
export const installBridgeHost = () => {
  execFileSync('docker', [
    'cp',
    fileURLToPath(new URL('./bridge-host.html', import.meta.url)),
    `${CONTAINER}:/usr/share/nginx/html/__bridge-host.html`,
  ]);
  return `${EDITOR}/__bridge-host.html?renderer=${encodeURIComponent(RENDERER)}`;
};

/** Opens the harness and waits for the renderer to complete its handshake. */
export const openBridgeHost = async (page) => {
  await page.goto(installBridgeHost(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__result?.ready, null, { timeout: 60000 });
};

/** Renders a composition's messages through the bridge and waits for the device. */
export const renderThroughBridge = async (page, messages) => {
  await page.evaluate(
    (payload) => window.__send({ type: 'RENDER_A2UI', payload }),
    messages
  );
  await page.waitForFunction(
    () => document.querySelectorAll('iframe').length > 0, null, { timeout: 60000 });
  const frame = page.frames().find((f) => f.url().startsWith(RENDERER));
  await frame.waitForSelector('.gather-instrument-content', { timeout: 60000 });
  return frame;
};

/**
 * The renderer frame, once its preview surface exists.
 *
 * `RENDERER_READY` says the bridge handshake happened; `__gatherPreview` is the
 * app's own surface and appears a moment later. Grabbing the frame on readiness
 * alone gets a frame whose `window` has neither.
 */
export const rendererFrame = async (page) => {
  let frame = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    frame = page.frames().find((f) => f.url().startsWith(RENDERER)) ?? null;
    if (frame) {
      const ready = await frame
        .evaluate(() => window.__gatherPreview != null)
        .catch(() => false);
      if (ready) return frame;
    }
    await page.waitForTimeout(250);
  }
  throw new Error('the renderer frame never exposed __gatherPreview');
};

/** What the device screen currently says. */
export const instrumentText = (frame) =>
  frame.evaluate(
    () => document.querySelector('.gather-instrument-content')?.innerText.replace(/\s+/g, ' ') ?? ''
  );

/** The renderer's own honesty surface: what ran, and how. */
export const fidelityLedger = (frame) =>
  frame.evaluate(
    () => document.querySelector('.preview-fidelity')?.innerText.replace(/\s+/g, ' ') ?? ''
  );

/** Supplies a sample image through the Component's own control, as an author would. */
export const chooseSampleImage = async (frame) => {
  await frame.evaluate(async () => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = '#101014';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#f5b301';
    context.beginPath();
    context.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
    context.fill();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const input = document.querySelector('input[type="file"]');
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'sample.png', { type: 'image/png' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await frame.waitForSelector('[data-testid="camera-preview"]', { timeout: 60000 }).catch(() => {});
};

/**
 * Presses a button in the device and waits for the ledger to name what ran.
 *
 * The predicate is a **function**, never a string: Playwright evaluates a
 * string predicate with `eval` in the page, which the renderer's CSP does not
 * permit. There is no `.catch` either — a condition that never arrives is the
 * failure, and swallowing it turns this back into the fixed sleep it replaced.
 */
export const press = async (frame, label, entry, timeout = 60000) => {
  const button = await frame.$(`button:has-text("${label}")`);
  if (!button) throw new Error(`the device has no "${label}" button`);
  await button.click();
  if (entry) {
    await frame.waitForFunction(
      (name) => (document.querySelector('.preview-fidelity')?.innerText ?? '').includes(name),
      entry,
      { timeout }
    );
  }
};

/**
 * The only messages a renderer may send its host.
 *
 * None of them changes the composition. That is the promise: running a Tool
 * produces data-model changes and actions, and never asks the host to rewrite
 * the Tool.
 */
export const RENDERER_OUTBOUND = new Set([
  'RENDERER_READY',
  'A2UI_CATALOG',
  'DATA_MODEL_CHANGE',
  'SEND_TO_SERVER',
]);
