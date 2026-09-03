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

const BODY = process.env.BODY ?? '{"id":"flower_v1","messages":[]}';
const CONTENT_TYPE = process.env.CONTENT_TYPE ?? 'application/json';
const fetched = [];

const loaded = await loadForm(readFileSync(process.env.FIXTURE, 'utf8'), {
  fetchFormAttachment: async (url) => {
    const href = typeof url === 'string' ? url : url?.href ?? String(url);
    fetched.push(href);
    return new Response(BODY, { status: 200, headers: { 'content-type': CONTENT_TYPE } });
  },
});

console.log('fetchFormAttachment called for:', JSON.stringify(fetched));
console.log('load status:', loaded.status);
if (loaded.status === 'failure') {
  console.log('error:', String(loaded.error?.message ?? loaded.error));
} else {
  const { root } = await loaded.createInstance();
  console.log('instance created OK; root reference:', root.currentState?.reference);
}
