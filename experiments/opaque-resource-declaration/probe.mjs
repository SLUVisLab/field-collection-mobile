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

const fetched = [];
const loaded = await loadForm(readFileSync(process.env.FIXTURE, 'utf8'), {
  fetchFormAttachment: async (url) => {
    const href = typeof url === 'string' ? url : url?.href ?? String(url);
    fetched.push(href);
    return new Response('', { status: 404, statusText: 'Not Found' });
  },
});
console.log('load status                     :', loaded.status);
if (loaded.status === 'failure') {
  console.log('error:', String(loaded.error?.message ?? loaded.error));
  process.exit(0);
}
console.log('fetchFormAttachment called for  :', JSON.stringify(fetched));

const { root } = await loaded.createInstance();
const flatten = (n, out = []) => { out.push(n); for (const c of n.currentState?.children ?? []) flatten(c, out); return out; };

console.log('\nprimary-instance nodes the engine surfaces:');
for (const node of flatten(root)) {
  const ref = node.currentState?.reference ?? '-';
  if (ref === '/data' || ref.startsWith('/data/meta')) continue;
  const hasBody = Boolean(node.definition?.bodyElement);
  console.log(`  ${String(node.nodeType).padEnd(14)} ${ref.padEnd(36)} body-backed=${String(hasBody).padEnd(5)} value=${JSON.stringify(node.currentState?.instanceValue ?? node.currentState?.value ?? null)}`);
}

const xmlOf = async (label) => {
  const payload = await root.prepareInstancePayload({ payloadType: 'chunked', maximumSize: 1e9 });
  const data = payload?.data?.[0];
  const file = data?.get?.('xml_submission_file');
  const text = typeof file?.text === 'function' ? await file.text() : String(file);
  console.log(`\n${label}\n  ${text}`);
  console.log('  attachments in payload:', JSON.stringify([...(data?.keys?.() ?? [])].filter((k) => k !== 'xml_submission_file')));
};

await xmlOf('fresh instance XML:');
const siteName = flatten(root).find((n) => n.currentState?.reference === '/data/site_name');
siteName?.setValue?.('North ridge');
await xmlOf('after answering site_name:');
