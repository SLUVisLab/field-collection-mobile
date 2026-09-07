/**
 * Drives a real Chrome against the locally deployed Composer and renderer.
 * See ./README.md for why this is a gate rather than a test.
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { SEGMENT_AND_MEASURE_INSTRUMENT } from 'gather-catalog';

const COMPOSER = process.env.COMPOSER_ORIGIN ?? 'http://composer.openfieldworks.localhost';
const RENDERER = process.env.RENDERER_ORIGIN ?? 'http://renderer.openfieldworks.localhost';
const CONTAINER = process.env.COMPOSER_CONTAINER ?? 'ofw-composer-composer-1';
const SURFACE = SEGMENT_AND_MEASURE_INSTRUMENT.messages[0].createSurface.surfaceId;

const failures = [];
const check = (label, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

// The host page has to be served by the Composer itself, or the origin under
// test is not the origin the CSP is about.
execFileSync('docker', [
  'cp',
  fileURLToPath(new URL('./host.html', import.meta.url)),
  `${CONTAINER}:/usr/share/nginx/html/__composer-bridge-gate.html`,
]);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

try {
  await page.goto(
    `${COMPOSER}/__composer-bridge-gate.html?renderer=${encodeURIComponent(`${RENDERER}/`)}`,
    { waitUntil: 'load' }
  );

  // The failure this gate exists for looks like nothing at all from the server,
  // so when the handshake never happens, say why: the browser's refusal is in
  // the console and nowhere else.
  try {
    await page.waitForFunction(() => window.__result.catalog, null, { timeout: 20000 });
  } catch {
    check('catalog handshake', false, consoleErrors.join(' | ') || 'no catalog and no console error');
    const framed = consoleErrors.find((e) => /frame-ancestors/.test(e));
    if (framed) {
      console.log('\n  The renderer refused to be framed by this Composer. Add its origin to');
      console.log('  RENDERER_FRAME_ANCESTORS in the deploy environment and redeploy the renderer.');
    }
    console.log(`\n${failures.length} failed`);
    process.exit(1);
  }
  const catalog = await page.evaluate(() => window.__result.catalog);
  const raw = catalog.components ?? catalog.catalog?.components ?? {};
  const names = (Array.isArray(raw) ? raw.map((c) => c.name ?? c.id) : Object.keys(raw)).filter(Boolean);
  check('catalog handshake', names.length > 0, `${names.length} components, ${catalog.catalogId ?? catalog.id ?? ''}`);
  check('Gather components advertised', names.some((n) => /^Gather|^Flow$/.test(n)),
    names.filter((n) => /^Gather|^Flow$/.test(n)).join(', '));

  const frame = () => page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(RENDERER));
  const text = () => frame().evaluate(() =>
    document.querySelector('.gather-instrument-content')?.innerText.trim().replace(/\s+/g, ' ') ?? '');

  await page.evaluate((m) => window.__send({ type: 'RENDER_A2UI', payload: m }),
    SEGMENT_AND_MEASURE_INSTRUMENT.messages);
  await frame().waitForFunction(
    () => (document.querySelector('.gather-instrument-content')?.innerText.trim() ?? '').length > 0,
    null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const rendered = await text();
  check('RENDER_A2UI renders the instrument', rendered.length > 0, JSON.stringify(rendered.slice(0, 60)));

  const setStatus = async (value) => {
    await page.evaluate(([surfaceId, v]) => window.__send({
      type: 'DATA_MODEL_CHANGE',
      payload: { updateDataModel: { surfaceId, path: '/gather/status', value: v } },
    }), [SURFACE, value]);
    await page.waitForTimeout(1200);
  };

  await setStatus('error');
  const afterModel = await text();
  check('DATA_MODEL_CHANGE selects another view', afterModel !== rendered && afterModel.length > 0,
    JSON.stringify(afterModel.slice(0, 60)));

  await setStatus('capture');
  const button = await frame().$('button');
  if (button) { await button.click(); await page.waitForTimeout(900); }
  const actions = await page.evaluate(() => window.__result.actions);
  check('SEND_TO_SERVER returns an action', actions.length > 0,
    actions.map((a) => a.action?.name).join(', '));

  // Documented and expected — see README.md. Anything else is a real problem.
  const unexpected = consoleErrors.filter((e) => !/camera is not allowed/.test(e));
  check('no unexpected console errors', unexpected.length === 0, unexpected.join(' | '));
} finally {
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
