import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  WEBVIEW_ENGINE_MODULE_SHA256,
  WEBVIEW_ENGINE_MODULE_URL,
} from '../dist/webview-engine-url.js';

test('embedded WebView module is byte-for-byte the pinned engine derivative', async () => {
  assert.match(WEBVIEW_ENGINE_MODULE_URL, /^data:text\/javascript;base64,/);

  const encoded = WEBVIEW_ENGINE_MODULE_URL.slice('data:text/javascript;base64,'.length);
  const embedded = Buffer.from(encoded, 'base64');
  const local = await readFile(new URL('../dist/index.js', import.meta.url));
  const digest = createHash('sha256').update(local).digest('hex');

  assert.equal(createHash('sha256').update(embedded).digest('hex'), WEBVIEW_ENGINE_MODULE_SHA256);
  assert.equal(digest, WEBVIEW_ENGINE_MODULE_SHA256);
  assert.deepEqual(embedded, local);
});
