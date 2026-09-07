import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync, deflateSync } from 'node:zlib';

import {
  CollectSettingsQrError,
  MAX_QR_DECOMPRESSED_BYTES,
  parseCollectSettingsQr,
  settingsQrLogDetails,
} from '../../src/provisioning/collectSettingsQr.js';
import { createPakoSettingsQrCodec } from '../../src/provisioning/collectSettingsQrCodec.js';

const encodeSettings = (settings) =>
  deflateSync(Buffer.from(JSON.stringify(settings), 'utf8')).toString('base64');

const settingsFor = (serverUrl) => ({
  general: { server_url: serverUrl },
  admin: {},
  project: { name: 'Kernza Field Trial' },
});

const codec = createPakoSettingsQrCodec();

const captureError = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof CollectSettingsQrError);
    return error;
  }
  assert.fail('expected CollectSettingsQrError');
};

test('parses Central’s padded base64(zlib(JSON)) App User Settings QR format', () => {
  const rawQrText = encodeSettings(
    settingsFor('https://central.example.org/v1/key/app-user-token-123/projects/42')
  );
  const parsed = parseCollectSettingsQr(rawQrText, { codec });

  assert.deepEqual(parsed, {
    baseUrl: 'https://central.example.org',
    projectId: 42,
    token: 'app-user-token-123',
    displayName: 'Kernza Field Trial',
  });
  assert.ok(!Object.values(parsed).includes(rawQrText), 'raw QR text is never returned');
});

test('requires general, admin, and project objects and rejects plaintext credential settings', () => {
  for (const settings of [
    { general: {}, project: {} },
    { general: {}, admin: [], project: {} },
    {
      ...settingsFor('https://central.example.org/v1/key/token/projects/1'),
      general: {
        server_url: 'https://central.example.org/v1/key/token/projects/1',
        password: 'not-supported',
      },
    },
  ]) {
    assert.throws(
      () => parseCollectSettingsQr(encodeSettings(settings), { codec }),
      CollectSettingsQrError
    );
  }
});

test('rejects non-HTTPS endpoints, non-Central paths, and encoded traversal in the App User key', () => {
  const unsupportedUrls = [
    'http://central.example.org/v1/key/token/projects/1',
    'https://central.example.org/v1/projects/1/formList',
    'https://central.example.org/v1/key/token%2F..%2Fother/projects/1',
    'https://central.example.org/v1/key/token/projects/0',
  ];
  for (const serverUrl of unsupportedUrls) {
    assert.throws(
      () => parseCollectSettingsQr(encodeSettings(settingsFor(serverUrl)), { codec }),
      CollectSettingsQrError
    );
  }
});

test('rejects raw DEFLATE because Collect Settings QR requires a zlib wrapper', () => {
  const rawDeflateBase64 = deflateRawSync(
    Buffer.from(
      JSON.stringify(
        settingsFor('https://central.example.org/v1/key/app-user-token/projects/1')
      ),
      'utf8'
    )
  ).toString('base64');
  assert.throws(() => parseCollectSettingsQr(rawDeflateBase64, { codec }), CollectSettingsQrError);
});

test('rejects malformed base64 and malformed zlib without retaining secret source text in errors', () => {
  const secretBearingSource = 'not-a-settings-qr-with-private-token';
  const base64Error = captureError(() =>
    parseCollectSettingsQr(secretBearingSource, { codec })
  );
  assert.doesNotMatch(`${base64Error.message}${JSON.stringify(base64Error)}`, /private-token/);

  const compressedError = captureError(() =>
    parseCollectSettingsQr(Buffer.from('not-zlib').toString('base64'), { codec })
  );
  assert.doesNotMatch(`${compressedError.message}${JSON.stringify(compressedError)}`, /not-zlib/);
});

test('passes a 64 KiB maximum to codecs and rejects oversized codec output', () => {
  let seenLimit = null;
  const oversizedCodec = {
    decodeBase64: () => new Uint8Array([0]),
    inflateZlib: (_bytes, { maxOutputBytes }) => {
      seenLimit = maxOutputBytes;
      return 'x'.repeat(maxOutputBytes + 1);
    },
  };

  assert.throws(
    () => parseCollectSettingsQr('AAAA', { codec: oversizedCodec }),
    CollectSettingsQrError
  );
  assert.equal(seenLimit, MAX_QR_DECOMPRESSED_BYTES);
});

test('production zlib codec rejects a compressed payload that expands beyond 64 KiB', () => {
  const oversizedSettings = settingsFor(
    'https://central.example.org/v1/key/app-user-token/projects/1'
  );
  oversizedSettings.project.name = 'x'.repeat(MAX_QR_DECOMPRESSED_BYTES);

  assert.throws(
    () => parseCollectSettingsQr(encodeSettings(oversizedSettings), { codec }),
    CollectSettingsQrError
  );
});

test('safe QR log details and parser errors exclude the App User token', () => {
  const token = 'app-user-token-never-in-log-details';
  const parsed = parseCollectSettingsQr(
    encodeSettings(settingsFor(`https://central.example.org/v1/key/${token}/projects/7`)),
    { codec }
  );
  const logDetails = settingsQrLogDetails(parsed);

  assert.deepEqual(logDetails, {
    baseUrl: 'https://central.example.org',
    projectId: 7,
    displayName: 'Kernza Field Trial',
  });
  assert.doesNotMatch(JSON.stringify(logDetails), new RegExp(token));
});
