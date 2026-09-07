import assert from 'node:assert/strict';
import test from 'node:test';

import * as hashing from '../src/index.js';
import { runHashingVectors } from '../vectors.js';

// The compatibility contract. instance_receipts.revision and the installed
// model directory names (projects/<key>/models/<digest>/) both persist these
// digests, so changing the algorithm has to break this test first.
//
// The same vectors run under Hermes (gates/HashingVectorsGateApp.js) and in a
// browser (packages/gather-hashing/browser-vectors.html), because the risk
// being guarded is that a runtime formats a number differently.

test('golden digest vectors hold on this runtime', () => {
  const { runtime, passed, failures } = runHashingVectors(hashing);
  assert.deepEqual(
    failures,
    [],
    `${failures.length} of ${passed + failures.length} vectors failed on ${runtime}`
  );
  assert.ok(passed > 40, `expected the full vector set to run, got ${passed}`);
});
