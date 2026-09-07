import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const enginePath = new URL('../dist/index.js', import.meta.url);
const outputPath = new URL('../dist/webview-engine-url.js', import.meta.url);
const engine = await readFile(enginePath);
const engineUrl = `data:text/javascript;base64,${engine.toString('base64')}`;
const sha256 = createHash('sha256').update(engine).digest('hex');

await writeFile(
  outputPath,
  `export const WEBVIEW_ENGINE_MODULE_URL = ${JSON.stringify(engineUrl)};\n` +
    `export const WEBVIEW_ENGINE_MODULE_SHA256 = ${JSON.stringify(sha256)};\n`
);
