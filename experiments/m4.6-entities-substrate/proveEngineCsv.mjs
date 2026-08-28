// M4.6.4 pre-flight: prove the STOCK @getodk/xforms-engine consumes plants.csv
// via the generic fetchFormAttachment seam in Node (slimdom DOM), before spending
// emulator time. Serves the live-captured form + resources from ../m4.6-entities-substrate/out.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const slimdomInstaller = join(here, '..', 'm2-slimdom-xforms', 'installDomCompatibility.js');

const { installSlimdomDomCompatibility } = require(slimdomInstaller);
installSlimdomDomCompatibility({ force: true });

// The engine's bundled Emscripten (tree-sitter XPath) loader references
// `__dirname` in its ENVIRONMENT_IS_NODE branch; that identifier is undefined in
// ESM scope. Provide it as a global so the (embedded-WASM) loader initializes.
// This is a Node-preflight shim only — the RN gate runs the engine in the WebView.
const engineDistDir = join(here, '..', '..', 'node_modules', '@getodk', 'xforms-engine', 'dist');
globalThis.__dirname = engineDistDir;
globalThis.__filename = join(engineDistDir, 'index.js');
if (typeof globalThis.require !== 'function') globalThis.require = require;

const OUT = join(here, 'out');
const formXml = readFileSync(join(OUT, 'form-entities.xml'), 'utf8');
const csvText = readFileSync(join(OUT, 'plants.csv'), 'utf8');
let imageBase64 = null;
try {
  imageBase64 = readFileSync(join(OUT, 'silphium-reference.jpg')).toString('base64');
} catch {
  imageBase64 = null;
}

const attachments = new Map([['plants.csv', { contentType: 'text/csv', text: csvText }]]);
if (imageBase64) attachments.set('silphium-reference.jpg', { contentType: 'image/jpeg', base64: imageBase64 });

const fetchFormAttachment = async (resourceUrl) => {
  const href = typeof resourceUrl === 'string' ? resourceUrl : resourceUrl?.href ?? String(resourceUrl);
  const filename = decodeURIComponent(href.split(/[/\\]/).pop() ?? '');
  const found = attachments.get(filename);
  if (!found) return new Response(null, { status: 404 });
  if (found.text != null) return new Response(found.text, { status: 200, headers: { 'content-type': found.contentType } });
  const bin = atob(found.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, { status: 200, headers: { 'content-type': found.contentType } });
};

const flatten = (node, acc = []) => {
  acc.push(node);
  for (const child of node.currentState?.children ?? []) flatten(child, acc);
  return acc;
};
const byRef = (root, ref) => flatten(root).find((n) => n.currentState?.reference === ref) ?? null;
const leaf = (root, ref) => {
  const n = byRef(root, ref);
  const v = n?.currentState?.value;
  return Array.isArray(v) ? v.map(String).join(' ') : v == null ? null : String(v);
};

const parseCsv = (text) => {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const keys = head.split(',');
  return lines.map((line) => Object.fromEntries(line.split(',').map((c, i) => [keys[i], c])));
};

const DERIVED = {
  '/data/field_site': 'site',
  '/data/block': 'block',
  '/data/column': 'column',
  '/data/row': 'row',
  '/data/plant_code': 'plant_code',
  '/data/entity_version': '__version',
};

const main = async () => {
  const { loadForm } = await import('@getodk/xforms-engine');
  const result = await loadForm(formXml, { fetchFormAttachment });
  if (result.status === 'failure') {
    console.log('M464_NODE_RESULT::' + JSON.stringify({ ok: false, stage: 'loadForm', error: String(result.error?.message ?? result.error) }));
    process.exit(1);
  }
  const instance = await result.createInstance();
  const root = instance.root;

  const selectNode = byRef(root, '/data/plant');
  const choices = selectNode?.currentState?.valueOptions ?? [];
  const rows = parseCsv(csvText);
  const target = rows[0];

  selectNode.selectValue(target.name);

  const derived = {};
  const derivedChecks = {};
  for (const [ref, col] of Object.entries(DERIVED)) {
    const got = leaf(root, ref);
    derived[ref] = got;
    derivedChecks[ref] = String(got) === String(target[col]);
  }
  const selectedValue = leaf(root, '/data/plant');
  const checks = {
    formLoaded: true,
    choicesMaterialized: choices.length === rows.length && rows.length > 0,
    selectedValueIsUuid: selectedValue === target.name && /^[0-9a-f-]{36}$/i.test(String(selectedValue)),
    ...derivedChecks,
  };
  const ok = Object.values(checks).every(Boolean);
  console.log('M464_NODE_RESULT::' + JSON.stringify({
    ok, choiceCount: choices.length, csvRowCount: rows.length,
    selectedUuid: target.name, selectedValue, derived,
    expected: { site: target.site, block: target.block, column: target.column, row: target.row, plant_code: target.plant_code, __version: target.__version },
    checks,
  }, null, 2));
  process.exit(ok ? 0 : 2);
};

main().catch((error) => {
  console.log('M464_NODE_RESULT::' + JSON.stringify({ ok: false, crash: String(error?.stack ?? error) }));
  process.exit(1);
});
