import test from 'node:test';
import assert from 'node:assert/strict';

import { scannedCodeValue } from '../../src/capabilities/camera/scanResult.js';

// After Phase 3 the app's camera capability namespace retains only scan-result
// decoding; photo acquisition is Component-owned (gather-components/camera).

test('barcode normalization returns a plain first payload without retaining barcode objects', () => {
  const first = { rawValue: undefined, displayValue: undefined };
  const second = { rawValue: 'scanned-settings-qr', displayValue: 'display-settings-qr' };

  assert.equal(scannedCodeValue([first, second]), 'scanned-settings-qr');
  assert.equal(scannedCodeValue([{ displayValue: 'fallback-code' }]), 'fallback-code');
  assert.equal(scannedCodeValue([]), null);
  assert.equal(scannedCodeValue(null), null);
});
