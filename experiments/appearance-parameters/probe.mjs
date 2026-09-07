import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const REPO = process.env.REPO;
const require = createRequire(join(REPO, 'package.json'));
require(join(REPO, 'archive/experiments/m2-slimdom-xforms/installDomCompatibility.js'))
  .installSlimdomDomCompatibility({ force: true });
const engineDist = join(REPO, 'node_modules/@getodk/xforms-engine/dist');
globalThis.__dirname = engineDist; globalThis.__filename = join(engineDist, 'index.js');
if (typeof globalThis.require !== 'function') globalThis.require = require;
const { loadForm } = await import(pathToFileURL(join(engineDist, 'index.js')).href);
const loaded = await loadForm(readFileSync(process.env.FIXTURE, 'utf8'));
if (loaded.status === 'failure') throw new Error(String(loaded.error?.message ?? loaded.error));
const { root } = await loaded.createInstance();
const flatten = (n, out = []) => { out.push(n); for (const c of n.currentState?.children ?? []) flatten(c, out); return out; };
for (const node of flatten(root)) {
  const ref = node.currentState?.reference ?? '-';
  if (ref === '/data' || ref.startsWith('/data/meta')) continue;
  console.log(`${String(node.nodeType).padEnd(26)} ${ref}`);
  const a = node.appearances;
  console.log(`   ctor=${a?.constructor?.name} size=${a?.size} keys=${JSON.stringify(Object.keys(a ?? {}))}`);
  try { console.log(`   spread=${JSON.stringify([...a])}`); } catch (e) { console.log(`   spread failed: ${e.message}`); }
  for (const probe of ['multiline', 'minimal', 'field-list', 'gather-multi-image', 'min=2', 'max=6', 'gather-custom']) {
    if (typeof a?.has === 'function' && a.has(probe)) console.log(`   has(${probe}) = true`);
  }
}
