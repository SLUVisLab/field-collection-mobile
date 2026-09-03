import assert from 'node:assert/strict';
import test from 'node:test';

import { workingAssetIdentity } from '../../src/scientific/assets/workingAssetIdentity.js';
import { createImageAssetService } from '../../src/scientific/assets/imageAssetService.js';

// The invariant a device run exposed: a persisted capture is referred to by the
// ledger row, the file on disk, the ImageAsset a composition receives, and the
// receipt that records it — and those four have to be the same name.
// docs/b-custom-composition-conventions.md §4b.

const media = (projectKey, name) => `projects/${projectKey}/media/${name}`;

test('the ledger id, the file name and the ImageAsset id are one mint', async () => {
  const { assetId, fileKey } = workingAssetIdentity({
    projectKey: 'p1',
    media,
    newId: () => 'abc123',
  });

  assert.equal(assetId, 'image-abc123');
  assert.equal(fileKey, 'projects/p1/media/image-abc123.jpg');
  // The file is named for the asset, so the name on disk cannot drift.
  assert.equal(fileKey.split('/').pop().replace(/\.jpg$/, ''), assetId);

  // And the asset service honours the caller's id rather than minting a second.
  // It minted one, which is how the ledger came to say image-…633 while the
  // receipt said image-…694 for the same bytes.
  const service = createImageAssetService({
    readCaptureBytes: async () => new Uint8Array([1]),
    writeBytesAtomic: async () => {},
    fileUriForKey: (key) => `file:///${key}`,
    newAssetId: () => 'A-SECOND-IDENTITY',
  });
  const asset = await service.persistCapture({
    capture: { path: '/cache/camera.jpg', contentType: 'image/jpeg', width: 2, height: 3 },
    fileKey,
    assetId,
  });

  assert.equal(asset.assetId, assetId);
  assert.equal(asset.path, fileKey);
  // A receipt records this exact object, so its assetId agrees by construction.
});

test('each capture gets its own identity', async () => {
  const ids = new Set();
  for (let i = 0; i < 4; i += 1) {
    ids.add(workingAssetIdentity({ projectKey: 'p1', media }).assetId);
  }
  assert.equal(ids.size, 4);
});

test('an identity cannot be minted without the project media path builder', () => {
  // Building the key here rather than accepting one is the point: it is what
  // keeps the file name and the id from being chosen independently.
  assert.throws(() => workingAssetIdentity({ projectKey: 'p1' }), /media path builder/);
});
