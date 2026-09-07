import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.env.REPO;
const require = createRequire(join(REPO, 'package.json'));
require(join(REPO, 'archive/experiments/m2-slimdom-xforms/installDomCompatibility.js'))
  .installSlimdomDomCompatibility({ force: true });
const engineDist = join(REPO, 'node_modules/@getodk/xforms-engine/dist');
globalThis.__dirname = engineDist;
globalThis.__filename = join(engineDist, 'index.js');
if (typeof globalThis.require !== 'function') globalThis.require = require;
const { loadForm } = await import(pathToFileURL(join(engineDist, 'index.js')).href);

const GATHER_NS = 'http://gather.slu.edu/xforms';

const loaded = await loadForm(readFileSync(process.env.FIXTURE, 'utf8'));
if (loaded.status === 'failure') throw new Error(String(loaded.error?.message ?? loaded.error));
const { root } = await loaded.createInstance();

const flatten = (n, out = []) => {
  out.push(n);
  for (const c of n.currentState?.children ?? []) flatten(c, out);
  return out;
};

const attrNS = (element, name) =>
  element && typeof element.getAttributeNS === 'function'
    ? element.getAttributeNS(GATHER_NS, name)
    : '<no getAttributeNS>';

console.log('node                   reference                              parent                       type/media   req   body:composition                  bind:retention  bind:output');
for (const node of flatten(root)) {
  const ref = node.currentState?.reference ?? '-';
  if (ref === '/data' || ref.startsWith('/data/meta')) continue;
  const def = node.definition ?? null;
  const bodyEl = def?.bodyElement?.element ?? null;
  const bindEl = def?.bind?.bindElement ?? null;
  const parent = node.parent?.currentState?.reference ?? '-';
  const media = node.nodeOptions?.media?.type ?? '';
  console.log(
    [
      String(node.nodeType).padEnd(22),
      ref.padEnd(38),
      parent.padEnd(28),
      `${node.valueType ?? '-'}${media ? '/' + media : ''}`.padEnd(12),
      String(node.currentState?.required ?? '-').padEnd(5),
      String(attrNS(bodyEl, 'composition') ?? 'null').padEnd(33),
      String(attrNS(bindEl, 'retention') ?? 'null').padEnd(15),
      String(attrNS(bindEl, 'output') ?? 'null'),
    ].join(' ')
  );
}

console.log('\n--- reachability of the definition objects ---');
const group = flatten(root).find((n) => n.currentState?.reference === '/data/flower_analysis');
console.log('group.definition present        :', Boolean(group?.definition));
console.log('group.definition.bodyElement    :', Boolean(group?.definition?.bodyElement));
console.log('group.definition.bodyElement.element getAttributeNS:', typeof group?.definition?.bodyElement?.element?.getAttributeNS);
console.log('group appearances               :', JSON.stringify([...(group?.appearances ?? [])]));
console.log('group child references          :', JSON.stringify((group?.currentState?.children ?? []).map((c) => c.currentState?.reference)));
