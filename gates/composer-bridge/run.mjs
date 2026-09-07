/**
 * Drives a real Chrome against the locally deployed Composer and renderer.
 * See ./README.md for why this is a gate rather than a test.
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { categorizedComponents, SEGMENT_AND_MEASURE_INSTRUMENT } from 'gather-catalog';

// The pinned upstream editor, which is a different origin from the Gather
// shell — see openfieldworks-web/deploy/README.md.
const COMPOSER = process.env.EDITOR_ORIGIN ?? 'http://editor.openfieldworks.localhost';
const RENDERER = process.env.RENDERER_ORIGIN ?? 'http://renderer.openfieldworks.localhost';
const CONTAINER = process.env.EDITOR_CONTAINER ?? 'ofw-editor-editor-1';
const SURFACE = SEGMENT_AND_MEASURE_INSTRUMENT.messages[0].createSurface.surfaceId;

// Derived from the canonical Tool rather than restated, so this cannot pass
// while the renderer advertises functions the shipped Tool does not use.
const CANONICAL_TOOL = JSON.parse(
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
const SEGMENT_AND_MEASURE_CALLS = [
  ...new Set(
    CANONICAL_TOOL.messages
      .flatMap((message) => message.updateComponents?.components ?? [])
      .map((component) => component.action?.functionCall?.call)
      .filter(Boolean)
  ),
];

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

  // The functions are what make Capabilities authorable. The renderer advertised
  // only upstream's Basic Catalog until 2026-09-05, so the Composer could not
  // author the Tool the device was already running.
  const rawFns = catalog.functions ?? catalog.catalog?.functions ?? {};
  const fnNames = new Set(
    (Array.isArray(rawFns) ? rawFns.map((f) => f.name ?? f) : Object.keys(rawFns)).filter(Boolean)
  );
  const toolCalls = SEGMENT_AND_MEASURE_CALLS.filter((call) => !fnNames.has(call));
  check('Gather functions advertised', toolCalls.length === 0,
    toolCalls.length ? `missing ${toolCalls.join(', ')}` : `${fnNames.size} functions`);

  // Can the agent author the canonical Tool's *explicit* ModelRef from what the
  // handshake gave it? The Tool pins a revision; the advertised schema must
  // offer that same revision, or the agent can only guess.
  const authoredRevision =
    CANONICAL_TOOL.messages.find((m) => m.updateDataModel)?.updateDataModel.value.modelRef.revision;
  const segmentFn = (Array.isArray(rawFns) ? rawFns : Object.values(rawFns)).find(
    (f) => f?.name === 'image_segment'
  );
  const offered = segmentFn?.parameters?.properties?.modelRef?.properties?.revision?.enum ?? [];
  check('explicit ModelRef is discoverable', offered.includes(authoredRevision),
    offered.length ? `${offered.length} revision(s) offered` : 'no revisions offered');

  // Gather's own taxonomy, declared in gather-catalog and attached by the
  // bridge. Derived from the catalog rather than restated, so a category added
  // there is asserted here without editing this file.
  const rawComponents = catalog.components ?? catalog.catalog?.components ?? {};
  const declaredHere = new Set(
    Object.values(rawComponents)
      .map((entry) => entry?.['x-gather-category'])
      .filter(Boolean)
  );
  const expected = new Set(Object.values(categorizedComponents()));
  check('Gather categories declared in the payload',
    declaredHere.size === expected.size && [...expected].every((c) => declaredHere.has(c)),
    [...declaredHere].sort().join(', ') || 'none');

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

  // The device frame must fit the pane the host gave it. It was drawn at a
  // fixed zoom and clipped by 186px in a 1600x1000 Composer window, hiding the
  // bottom of the phone — which is where a Tool's Accept button lives.
  const fit = await frame().evaluate(() => {
    const stage = document.querySelector('.renderer-stage');
    const el = stage?.firstElementChild;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      clipped: Math.max(0, Math.round(rect.bottom - document.documentElement.clientHeight)),
      height: Math.round(rect.height),
    };
  });
  check('device frame fits its pane', fit != null && fit.clipped === 0,
    fit ? `${fit.height}px tall, ${fit.clipped}px clipped` : 'no stage found');

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
