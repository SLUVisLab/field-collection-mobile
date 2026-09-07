/**
 * Can the Composer's own agent author a Gather Tool from the catalog alone?
 *
 * This is a **discoverability** experiment, not a runtime one. Everything the
 * agent needs already executes — the question is whether the catalog tells it
 * enough to wire a Tool correctly without a human who has read our source.
 *
 * The generated document is written out verbatim so a baseline and a later run
 * can be compared on the same prompt.
 *
 *   node gates/agent-authoring/run.mjs [outputFile]
 *
 * Needs gemini.env (gitignored). The key is typed into the Composer's own
 * Settings and stays in that browser profile; it never enters the repo or an
 * image.
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EDITOR = process.env.EDITOR_ORIGIN ?? 'http://editor.openfieldworks.localhost';
const RENDERER = process.env.RENDERER_ORIGIN ?? 'http://renderer.openfieldworks.localhost';
const OUT = process.argv[2] ?? 'agent-tool.json';

/** One fixed prompt, so before/after are comparable. */
export const PROMPT =
  'Create a Gather Tool that lets a researcher choose or capture an image, ' +
  'persists that image, segments the subject using image.segment, measures the ' +
  'segmented area, shows the original image and segmentation for review, and ' +
  'returns the image, area, and area unit. Use an appropriate compatible Gather model.';

const keyFrom = (path) => {
  const line = readFileSync(path, 'utf8').split('\n').find((l) => l.startsWith('GEMINI_API_KEY='));
  const key = line?.slice('GEMINI_API_KEY='.length).trim();
  if (!key) throw new Error('gemini.env has no GEMINI_API_KEY. Copy gemini.env.example and paste one.');
  return key;
};

const key = keyFrom(fileURLToPath(new URL('../../gemini.env', import.meta.url)));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

// --- settings: renderer + key ----------------------------------------------
await page.goto(`${EDITOR}/settings`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);

await page.click('#renderer-select');
await page.waitForTimeout(400);
await page.click('mat-option:has-text("Gather renderer (local)")');
await page.waitForTimeout(600);

await page.click('button[aria-label="Add Gemini API key"]');
await page.waitForTimeout(800);
await page.fill('#api-key-name-input', 'Smoke test');
await page.fill('#api-key-value-input', key);
await page.click('mat-dialog-container button:has-text("Add")');
await page.waitForTimeout(1200);
console.log('settings: renderer selected, key added');

// --- ask the agent ----------------------------------------------------------
await page.goto(`${EDITOR}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

const before = await page.evaluate(() => window.monaco?.editor?.getModels?.()[0]?.getValue() ?? '');
const composer = await page.$('textarea');
if (!composer) {
  console.error('No chat input found — is the key accepted?');
  await browser.close();
  process.exit(1);
}
await composer.fill(PROMPT);
await composer.press('Enter');
console.log('prompt sent, waiting for the agent…');

// The agent streams, and mid-stream the editor briefly holds a truncated
// document. Waiting for "different and stable" caught one of those, so require
// a document that actually declares components and hold it stable for longer.
const looksComplete = (text) => {
  if (!text || text === before) return false;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) && parsed.some((m) => m?.updateComponents?.components?.length > 0);
  } catch {
    return false;
  }
};

let settled = before;
let stableFor = 0;
for (let tick = 0; tick < 150; tick += 1) {
  await page.waitForTimeout(2000);
  const now = await page.evaluate(() => window.monaco?.editor?.getModels?.()[0]?.getValue() ?? '');
  if (looksComplete(now) && now === settled) {
    stableFor += 1;
    if (stableFor >= 5) break;
  } else {
    stableFor = 0;
    settled = now;
  }
}
if (!looksComplete(settled)) {
  console.error('\nThe agent produced no complete document. Transcript follows.');
}

const chat = await page.evaluate(() => document.body.innerText.slice(0, 1200));
writeFileSync(OUT, settled);
console.log(`\nauthored document written to ${OUT} (${settled.length} chars)`);
console.log('\n--- chat transcript (head) ---');
console.log(chat.split('\n').filter((l) => l.trim()).slice(0, 25).join('\n'));
await browser.close();
