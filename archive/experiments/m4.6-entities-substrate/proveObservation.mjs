// M4.6.6 pre-flight (Node): load the Entity-aware observation form WITH plants.csv
// via fetchFormAttachment, select an existing Entity, change status + set
// observation fields, serialize, and inspect the Entity UPDATE block (id,
// update flag, baseVersion). No live submit here.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { installSlimdomDomCompatibility } = require(join(here, '..', 'm2-slimdom-xforms', 'installDomCompatibility.js'));
installSlimdomDomCompatibility({ force: true });

const dist = join(here, '..', '..', 'node_modules', '@getodk', 'xforms-engine', 'dist');
globalThis.__dirname = dist;
globalThis.__filename = join(dist, 'index.js');
if (typeof globalThis.require !== 'function') globalThis.require = require;

const formXml = readFileSync(join(here, 'out', 'form-entities.xml'), 'utf8');
const csvText = readFileSync(join(here, 'out', 'plants.csv'), 'utf8');

const fetchFormAttachment = async (resourceUrl) => {
  const href = typeof resourceUrl === 'string' ? resourceUrl : resourceUrl?.href ?? String(resourceUrl);
  const filename = decodeURIComponent(href.split('/').pop() ?? '');
  if (filename === 'plants.csv') return new Response(csvText, { status: 200, headers: { 'content-type': 'text/csv' } });
  return new Response(null, { status: 404 });
};

const flatten = (node, acc = []) => { acc.push(node); for (const c of node.currentState?.children ?? []) flatten(c, acc); return acc; };
const byRef = (root, ref) => flatten(root).find((n) => n.currentState?.reference === ref) ?? null;
const setVal = (root, ref, v) => {
  const n = byRef(root, ref);
  if (!n) throw new Error('node not found ' + ref);
  if (typeof n.selectValue === 'function' && n.currentState?.valueOptions) n.selectValue(String(v));
  else n.setValue(String(v));
};
const parseCsv = (t) => { const [h, ...ls] = t.trim().split(/\r?\n/); const k = h.split(','); return ls.map((l) => Object.fromEntries(l.split(',').map((c, i) => [k[i], c]))); };

const extractEntity = (xml) => {
  const block = xml.match(/<entity\b[^>]*\/?>(?:[\s\S]*?<\/entity>)?/i)?.[0] ?? '';
  return {
    block,
    id: block.match(/\bid="([^"]*)"/i)?.[1] ?? null,
    dataset: block.match(/\bdataset="([^"]*)"/i)?.[1] ?? null,
    update: block.match(/\bupdate="([^"]*)"/i)?.[1] ?? null,
    baseVersion: block.match(/\bbaseVersion="([^"]*)"/i)?.[1] ?? null,
  };
};

const main = async () => {
  const { loadForm } = await import('@getodk/xforms-engine');
  const result = await loadForm(formXml, { fetchFormAttachment });
  if (result.status === 'failure') { console.log('M466_NODE_RESULT::' + JSON.stringify({ ok: false, error: String(result.error?.message ?? result.error) })); process.exit(1); }
  const instance = await result.createInstance();
  const root = instance.root;

  const rows = parseCsv(csvText);
  const target = rows[0];
  const oldStatus = target.status;
  const newStatus = oldStatus === 'active' ? 'missing' : 'active';

  setVal(root, '/data/plant', target.name);
  setVal(root, '/data/plant_status', newStatus);
  setVal(root, '/data/flower_head_count', 7);
  setVal(root, '/data/plant_height_cm', 12.5);

  const payload = await root.prepareInstancePayload();
  const xml = await payload.data[0].get('xml_submission_file').text();
  const entity = extractEntity(xml);

  const checks = {
    entityUpdateBlock: entity.update === '1' && entity.dataset === 'plants',
    entityIdIsSelectedUuid: entity.id === target.name,
    baseVersionFromCsv: entity.baseVersion === target.__version,
    measurementNotInEntityBlock: !/flower_head_count|plant_height_cm/.test(entity.block),
    submissionHasMeasurement: /<flower_head_count>7<\/flower_head_count>/.test(xml) && /<plant_height_cm>12\.5<\/plant_height_cm>/.test(xml),
  };
  console.log('M466_NODE_RESULT::' + JSON.stringify({
    ok: Object.values(checks).every(Boolean),
    selectedUuid: target.name, oldStatus, newStatus, baseVersion: entity.baseVersion,
    entity: { id: entity.id, update: entity.update, baseVersion: entity.baseVersion }, checks,
  }, null, 2));
  console.log('--- entity block ---\n' + entity.block);
};

main().catch((e) => { console.log('M466_NODE_RESULT::' + JSON.stringify({ ok: false, crash: String(e?.stack ?? e) })); process.exit(1); });
