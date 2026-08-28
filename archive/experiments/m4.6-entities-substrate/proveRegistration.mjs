// M4.6.5 pre-flight (Node): load the registration form, set values, serialize,
// and inspect the Entity create block the engine produces. No live submit here.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { installSlimdomDomCompatibility } = require(join(here, '..', 'm2-slimdom-xforms', 'installDomCompatibility.js'));
installSlimdomDomCompatibility({ force: true });

const engineDistDir = join(here, '..', '..', 'node_modules', '@getodk', 'xforms-engine', 'dist');
globalThis.__dirname = engineDistDir;
globalThis.__filename = join(engineDistDir, 'index.js');
if (typeof globalThis.require !== 'function') globalThis.require = require;

const formXml = readFileSync(join(here, 'out', 'form-registration.xml'), 'utf8');

const flatten = (node, acc = []) => {
  acc.push(node);
  for (const child of node.currentState?.children ?? []) flatten(child, acc);
  return acc;
};
const byRef = (root, ref) => flatten(root).find((n) => n.currentState?.reference === ref) ?? null;
const setVal = (root, ref, v) => {
  const n = byRef(root, ref);
  if (!n) throw new Error('node not found ' + ref);
  if (typeof n.selectValue === 'function' && n.currentState?.valueOptions) n.selectValue(String(v));
  else n.setValue(String(v));
};

const extractEntity = (xml) => {
  const block = xml.match(/<entity\b[\s\S]*?<\/entity>/i)?.[0] ?? '';
  return {
    block,
    id: block.match(/\bid="([^"]*)"/i)?.[1] ?? null,
    dataset: block.match(/\bdataset="([^"]*)"/i)?.[1] ?? null,
    create: block.match(/\bcreate="([^"]*)"/i)?.[1] ?? null,
    label: block.match(/<label>([\s\S]*?)<\/label>/i)?.[1] ?? null,
  };
};

const main = async () => {
  const { loadForm } = await import('@getodk/xforms-engine');
  const result = await loadForm(formXml);
  if (result.status === 'failure') {
    console.log('M465_NODE_RESULT::' + JSON.stringify({ ok: false, error: String(result.error?.message ?? result.error) }));
    process.exit(1);
  }
  const instance = await result.createInstance();
  const root = instance.root;

  const site = 'M46-node01';
  setVal(root, '/data/field_site', site);
  setVal(root, '/data/block', 9);
  setVal(root, '/data/column', 9);
  setVal(root, '/data/row', 9);
  setVal(root, '/data/plant_location', '38.5242 -90.5582 0 5');
  setVal(root, '/data/status', 'active');

  const plantCode = byRef(root, '/data/plant_code')?.currentState?.value;
  const payload = await root.prepareInstancePayload();
  const xml = await payload.data[0].get('xml_submission_file').text();
  const entity = extractEntity(xml);

  const checks = {
    plantCodeCalculated: plantCode === `${site}-B9-C9-R9`,
    entityCreateBlock: entity.create === '1' && entity.dataset === 'plants',
    entityHasUuid: /[0-9a-f-]{36}/i.test(entity.id ?? ''),
    labelIsPlantCode: entity.label === `${site}-B9-C9-R9`,
  };
  console.log('M465_NODE_RESULT::' + JSON.stringify({
    ok: Object.values(checks).every(Boolean),
    plantCode, entity: { id: entity.id, dataset: entity.dataset, create: entity.create, label: entity.label },
    serializeStatus: payload.status, checks,
  }, null, 2));
  console.log('--- entity block ---\n' + entity.block);
};

main().catch((e) => { console.log('M465_NODE_RESULT::' + JSON.stringify({ ok: false, crash: String(e?.stack ?? e) })); process.exit(1); });
