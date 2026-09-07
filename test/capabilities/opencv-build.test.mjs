/**
 * What the vendored OpenCV build must keep being true.
 *
 * `tools/opencv-build/` produces `apps/renderer/vendor/opencv/`, and two
 * properties of that artifact are load-bearing well away from where they would
 * fail. These check them against the committed bytes.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { findDynamicExecution } from '../../tools/opencv-build/assert-no-eval.mjs';
import { loadOpenCv } from '../../apps/renderer/src/preview/web/openCvModule.js';

const at = (path) => fileURLToPath(new URL(path, import.meta.url));
const VENDOR = '../../apps/renderer/vendor/opencv/';

const cv = await loadOpenCv();

test('the artifact evaluates no strings, so the renderer needs no unsafe-eval', () => {
  const sites = findDynamicExecution(readFileSync(at(`${VENDOR}opencv.js`), 'utf8'));
  assert.deepEqual(
    sites,
    [],
    `The renderer's CSP omits 'unsafe-eval' because this file contains none. ` +
      `Found: ${sites.map((s) => `${s.name} at line ${s.line}`).join(', ')}`
  );
});

// The trim is by module, not by function, and that is the whole difference
// between "a smaller OpenCV" and "a build you reconfigure whenever you write a
// new call". None of the functions below is called anywhere in Gather today;
// all of them are one `cv.` away from being usable, with no rebuild.
//
// If this fails, someone narrowed the build to the functions in use. That trades
// a few hundred KB for a build step in the middle of unrelated work — take the
// KB back some other way.
const UNUSED_BUT_AVAILABLE = [
  'adaptiveThreshold',
  'approxPolyDP',
  'bilateralFilter',
  'Canny',
  'contourArea',
  'convexHull',
  'dilate',
  'erode',
  'fitEllipse',
  'GaussianBlur',
  'HoughCircles',
  'matchTemplate',
  'minAreaRect',
  'moments',
  'morphologyEx',
  'resize',
  'threshold',
  'warpPerspective',
];

test('the whole of core and imgproc is bound, not just what we call today', () => {
  const missing = UNUSED_BUT_AVAILABLE.filter((name) => typeof cv[name] !== 'function');
  assert.deepEqual(missing, [], `not bound: ${missing.join(', ')}`);
});

test('the calls the measurement adapter actually makes are bound', () => {
  const used = [
    'arcLength',
    'boundingRect',
    'connectedComponentsWithStats',
    'countNonZero',
    'cvtColor',
    'findContours',
    'Laplacian',
    'matFromArray',
    'meanStdDev',
  ];
  const missing = used.filter((name) => typeof cv[name] !== 'function');
  assert.deepEqual(missing, [], `not bound: ${missing.join(', ')}`);
  for (const type of ['Mat', 'MatVector']) assert.equal(typeof cv[type], 'function', type);
});

test('provenance records what produced the bytes', () => {
  const provenance = JSON.parse(readFileSync(at(`${VENDOR}provenance.json`), 'utf8'));
  assert.equal(provenance.opencvVersion, '4.12.0', 'must match the device (react-native-fast-opencv)');
  assert.ok(provenance.buildFlags.includes('-sDYNAMIC_EXECUTION=0'));
  assert.ok(provenance.modules.includes('core') && provenance.modules.includes('imgproc'));
});
