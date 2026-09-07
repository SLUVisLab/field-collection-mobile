/**
 * The Composer's Function browser, driven in a real browser.
 *
 * Components are the nouns of an authored Tool and Functions are the verbs, and
 * the gallery showed only the nouns — an author could see what a Tool would look
 * like and not what it could do. This drives the other half.
 *
 * Everything Gather-specific arrives as Catalog *data*: two `x-host-*`
 * annotations the renderer attaches, which the patched gallery renders
 * generically. Proven before any of it was built — a probe annotation on every
 * function entry reached the editor intact.
 *
 *   npm run gate:function-browser
 */
import { chromium } from 'playwright-core';

const EDITOR = process.env.EDITOR_ORIGIN ?? 'http://editor.openfieldworks.localhost';
const RENDERER = process.env.AUTHORING_RENDERER_URL ?? 'http://renderer.openfieldworks.localhost';

const fail = [];
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
  if (!cond) fail.push(label);
};

const CAPABILITIES = [
  'image_segment', 'image_classify', 'measure_area', 'measure_perimeter',
  'measure_boundingBox', 'measure_centroid', 'measure_color', 'measure_sharpness',
];
const HOST_FUNCTIONS = ['gather_persistAsset', 'gather_completeComposition'];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  // Enter the way a researcher does: load the app with a renderer, then use the
  // navigation rail. Going straight to /functions works but arrives before any
  // catalog is connected, which tests the router rather than the browser.
  await page.goto(`${EDITOR}/?renderer=${encodeURIComponent(RENDERER)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);

  const rail = await page.evaluate(() =>
    [...document.querySelectorAll('a[mat-list-item]')].map((a) => a.getAttribute('aria-label')));
  ok('Functions Gallery has its own entry in the navigation rail',
    rail.includes('Functions Gallery'), rail.join(' | '));
  ok('and A2A Agent Testing is no longer offered', !rail.includes('A2A Agent Testing'));

  await page.click('a[aria-label="Functions Gallery"]');
  await page.waitForTimeout(7000);

  // --- annotations survive the bridge --------------------------------------
  const catalog = await page.evaluate(async () => {
    const response = await fetch('/config.json');
    return response.ok;
  });
  ok('the gallery opened against a live catalog', catalog);

  const listed = await page.evaluate(() =>
    [...document.querySelectorAll('.component-nav-item')].map((el) => el.textContent.trim()));

  for (const name of CAPABILITIES) {
    ok(`${name} is listed`, listed.includes(name));
  }
  for (const name of HOST_FUNCTIONS) {
    ok(`${name} is listed — a host function is an ordinary Function here`, listed.includes(name));
  }

  // --- categories come from the host, not from guessing ---------------------
  const headings = await page.evaluate(() =>
    [...document.querySelectorAll('.category-header')].map((el) => el.textContent.trim()));
  ok('categories come from x-host-category',
    headings.includes('Measurement') && headings.includes('Image') && headings.includes('Tool lifecycle'),
    headings.join(' | '));

  // --- detail: usage, parameters, returns ----------------------------------
  await page.click('.component-nav-item:has-text("measure_area")');
  await page.waitForTimeout(1500);

  const detail = await page.evaluate(() => ({
    title: document.querySelector('.component-title')?.textContent.trim() ?? '',
    description: document.querySelector('.component-description')?.textContent.trim() ?? '',
    usage: document.querySelector('.usage-code')?.textContent ?? '',
    params: [...document.querySelectorAll('.prop-name')].map((el) => el.textContent.trim()),
    types: [...document.querySelectorAll('.prop-type')].map((el) => el.textContent.trim()),
    hasPreviewCard: !!document.querySelector('.preview-card:not([hidden])'),
  }));

  ok('the detail names the function', detail.title === 'measure_area', detail.title);
  ok('and carries its description', /area of the masked region/i.test(detail.description),
    detail.description.slice(0, 70));

  // Usage must be the host's actual JSON, and must parse.
  let parsed = null;
  try { parsed = JSON.parse(detail.usage); } catch { /* reported below */ }
  ok('Usage renders host-supplied JSON that parses', parsed != null, detail.usage.slice(0, 80));
  ok('and it is the real invocation shape',
    parsed?.functionCall?.call === 'measure_area' &&
    parsed?.functionCall?.args?.mask?.path === '/working/mask' &&
    parsed?.resultPath === '/working/area',
    JSON.stringify(parsed));

  ok('parameters come from the function metadata', detail.params.includes('mask'),
    detail.params.join(', '));
  // `measure.area` returns a Quantity — `{ value, unit }` — so the catalog's
  // returnType is 'object'. An earlier version of this gate asserted 'decimal',
  // which was the illustrative type from the design note rather than the
  // contract's.
  ok('the return type is shown', detail.types.includes('object'), JSON.stringify(detail.types));

  // --- copy ----------------------------------------------------------------
  await page.click('.copy-button');
  await page.waitForTimeout(600);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  ok('the copy button copies the invocation', clipboard.trim() === detail.usage.trim(),
    clipboard.slice(0, 60));

  // --- a model-backed capability still teaches the default -----------------
  await page.click('.component-nav-item:has-text("image_segment")');
  await page.waitForTimeout(1200);
  const segment = await page.evaluate(() => document.querySelector('.usage-code')?.textContent ?? '');
  ok('image_segment omits modelRef, which is what selects the default',
    !segment.includes('modelRef') && segment.includes('image_segment'), segment.slice(0, 90));

  // --- the Components gallery is unchanged ---------------------------------
  await page.click('a[aria-label="Components Gallery"]');
  await page.waitForTimeout(4000);
  const components = await page.evaluate(() => ({
    listed: [...document.querySelectorAll('.component-nav-item')].map((el) => el.textContent.trim()),
    headings: [...document.querySelectorAll('.category-header')].map((el) => el.textContent.trim()),
  }));
  ok('the Components list still renders', components.listed.includes('CameraView'),
    `${components.listed.length} components`);
  ok('and still groups by declared category',
    components.headings.some((h) => /capture/i.test(h)), components.headings.join(' | '));
  ok('the Components view shows only components',
    !components.listed.includes('measure_area'),
    'the two galleries are separate destinations, not one list');

  const real = errors.filter((e) => !/camera is not allowed/.test(e));
  ok('no unexpected page errors', real.length === 0, real.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}

console.log(fail.length ? `\n${fail.length} failed` : '\nFunction browser green');
process.exit(fail.length ? 1 : 0);
