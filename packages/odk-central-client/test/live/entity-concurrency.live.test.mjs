import test from 'node:test';
import assert from 'node:assert/strict';

import { OdkCentralClient } from '../../src/OdkCentralClient.js';
import { createSessionAuth } from '../../src/auth.js';
import { ODK_CENTRAL_ERROR_CODES } from '../../src/errors.js';

/**
 * Opt-in LIVE M4.7.3 test: direct REST Entity update with explicit baseVersion
 * concurrency semantics.
 *
 *   ODK_CENTRAL_URL, ODK_CENTRAL_PROJECT_ID, ODK_CENTRAL_EMAIL, ODK_CENTRAL_PASSWORD
 *   ODK_CENTRAL_DATASET (optional, default "plants")
 */
const {
  ODK_CENTRAL_URL,
  ODK_CENTRAL_PROJECT_ID,
  ODK_CENTRAL_EMAIL,
  ODK_CENTRAL_PASSWORD,
  ODK_CENTRAL_DATASET,
} = process.env;

const DATASET = ODK_CENTRAL_DATASET || 'plants';
const LIVE = Boolean(ODK_CENTRAL_URL && ODK_CENTRAL_PROJECT_ID && ODK_CENTRAL_EMAIL && ODK_CENTRAL_PASSWORD);
const skip = LIVE ? false : 'live env not configured (set ODK_CENTRAL_URL/PROJECT_ID/EMAIL/PASSWORD to run)';

const webUserClient = () =>
  new OdkCentralClient({
    baseUrl: ODK_CENTRAL_URL,
    projectId: ODK_CENTRAL_PROJECT_ID,
    auth: createSessionAuth({ email: ODK_CENTRAL_EMAIL, password: ODK_CENTRAL_PASSWORD }),
    timeoutMs: 45000,
  });

test('live: updateEntity enforces baseVersion and rejects stale updates', { skip }, async () => {
  const client = webUserClient();
  const [first] = await client.listEntities({ name: DATASET });
  assert.ok(first, `expected at least one Entity in dataset ${DATASET}`);

  const uuid = first.uuid;
  const before = await client.getEntity({ name: DATASET, uuid });
  const beforeVersion = before.currentVersion.version;
  const beforeStatus = before.currentVersion.data.status;
  const toggledStatus = beforeStatus === 'active' ? 'missing' : 'active';

  let updatedVersion = null;
  let staleErrorSnapshot = null;
  try {
    const updated = await client.updateEntity({
      name: DATASET,
      uuid,
      baseVersion: beforeVersion,
      data: { status: toggledStatus },
    });
    updatedVersion = updated.currentVersion.version;
    assert.equal(updatedVersion, beforeVersion + 1);
    assert.equal(updated.currentVersion.baseVersion, beforeVersion);
    assert.equal(updated.currentVersion.data.status, toggledStatus);

    await assert.rejects(
      client.updateEntity({
        name: DATASET,
        uuid,
        baseVersion: beforeVersion,
        data: { status: beforeStatus },
      }),
      (error) => {
        staleErrorSnapshot = {
          code: error.code,
          httpStatus: error.httpStatus,
          retryable: error.retryable,
          message: error.message,
          details: error.details,
        };
        assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.STALE_ENTITY_BASE_VERSION);
        assert.ok(error.httpStatus === 409 || error.httpStatus === 412);
        assert.equal(error.retryable, false);
        return true;
      }
    );

    console.log(`M473_LIVE_RESULT::${JSON.stringify({
      dataset: DATASET,
      uuid,
      beforeVersion,
      updatedVersion,
      beforeStatus,
      toggledStatus,
      staleError: staleErrorSnapshot,
    }, null, 2)}`);
  } finally {
    if (updatedVersion != null) {
      const restored = await client.updateEntity({
        name: DATASET,
        uuid,
        baseVersion: updatedVersion,
        data: { status: beforeStatus },
      });
      assert.equal(restored.currentVersion.data.status, beforeStatus);
    }
  }
});
