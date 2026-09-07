// The browser's measurement adapter, against shapes whose answers are known
// without running either runtime.
//
// These exercise the real OpenCV call sequence — `findContours` + `arcLength`,
// `connectedComponentsWithStats`, `meanStdDev`, `Laplacian` — the same functions
// the device calls through react-native-fast-opencv, at the same OpenCV version
// (4.12.0). Only decoding differs between the hosts, and decoding is not what
// these check.
//
// They exist because an earlier attempt reimplemented this arithmetic by hand
// and over-counted the contours of holes. Reproducing `findContours` means
// reproducing Suzuki–Abe border following; importing OpenCV means not having to.
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadOpenCv } from '../../apps/renderer/src/preview/web/openCvModule.js';
import {
  imageMeasurementsFromMats,
  maskMatOf,
  maskMeasurementsFromMat,
  openCvReady,
} from '../../apps/renderer/src/preview/web/openCvWebMeasurementAdapter.js';

// Both: `openCvReady` is what the adapter waits on internally, and the shared
// module is where these tests get `cv` to build their fixtures. It is one load —
// the module memoises it — so this is not two OpenCVs.
await openCvReady();
const cv = await loadOpenCv();

/** A single-channel mask Mat, foreground 255, from a predicate. */
const maskMat = ({ width, height, isForeground }) => {
  const binary = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) binary[y * width + x] = isForeground(x, y) ? 255 : 0;
  }
  return cv.matFromArray(height, width, cv.CV_8UC1, binary);
};

const rgbMat = ({ width, height, colourAt }) => {
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colourAt(x, y);
      const p = (y * width + x) * 3;
      rgb[p] = r; rgb[p + 1] = g; rgb[p + 2] = b;
    }
  }
  return cv.matFromArray(height, width, cv.CV_8UC3, rgb);
};

const rectangle = ({ width, height, x, y, w, h }) => ({
  width, height, isForeground: (px, py) => px >= x && px < x + w && py >= y && py < y + h,
});

const close = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${what}: ${actual} is not within ${tolerance} of ${expected}`);

const measureMask = (shape) => {
  const mat = maskMat(shape);
  try {
    return maskMeasurementsFromMat(mat);
  } finally {
    mat.delete();
  }
};

test('a rectangle measures exactly what its geometry says', () => {
  const m = measureMask(rectangle({ width: 20, height: 20, x: 4, y: 5, w: 8, h: 6 }));
  assert.deepEqual(m.area, { value: 48, unit: 'px2' });
  assert.deepEqual(m.boundingBox, { x: 4, y: 5, width: 8, height: 6, unit: 'px' });
  // Contours walk pixel centres, so the polygon is (w-1) × (h-1) — 4 less than
  // the crack-counting perimeter a hand-rolled implementation tends to produce.
  assert.equal(m.perimeter.value, 2 * (8 - 1) + 2 * (6 - 1));
  assert.equal(m.perimeter.boundary, 'all-contours');
  close(m.centroid.x, 4 + 3.5, 0.001, 'centroid x');
  close(m.centroid.y, 5 + 2.5, 0.001, 'centroid y');
  assert.equal(m.centroid.semantics, 'largest-connected-foreground-component');
});

test('a disc approaches its true circumference', () => {
  const radius = 24;
  const size = 64;
  const m = measureMask({
    width: size, height: size,
    isForeground: (x, y) => {
      const dx = x - (size - 1) / 2;
      const dy = y - (size - 1) / 2;
      return dx * dx + dy * dy <= radius * radius;
    },
  });
  const circumference = 2 * Math.PI * radius;
  close(m.perimeter.value, circumference, circumference * 0.05, 'disc perimeter');
  close(m.area.value, Math.PI * radius * radius, Math.PI * radius * radius * 0.02, 'disc area');
});

test('a hole contributes its own contour, which is why RETR_LIST is used', () => {
  const outer = rectangle({ width: 40, height: 40, x: 5, y: 5, w: 20, h: 20 });
  const holed = {
    ...outer,
    isForeground: (x, y) => outer.isForeground(x, y) && !(x >= 12 && x < 18 && y >= 12 && y < 18),
  };
  const solid = measureMask(outer);
  const withHole = measureMask(holed);

  assert.equal(withHole.area.value, solid.area.value - 36);
  // The hole's inner contour walks the 6×6 opening at pixel centres: four sides
  // of five steps, and four corners taken diagonally at √2 each. Not 28 — that
  // assumes square corners a chain code does not take. The hand-rolled attempt
  // added ≈51.3, roughly double, because its trace wandered off the hole.
  const added = withHole.perimeter.value - solid.perimeter.value;
  close(added, 20 + 4 * Math.SQRT2, 0.001, 'hole contour');
});

test('the centroid follows the largest component, not the average of all', () => {
  const big = rectangle({ width: 60, height: 30, x: 2, y: 2, w: 10, h: 10 });
  const m = measureMask({
    ...big,
    isForeground: (x, y) => big.isForeground(x, y) || (x >= 50 && x < 52 && y >= 20 && y < 22),
  });
  close(m.centroid.x, 6.5, 0.001, 'the speck must not drag the centroid');
  close(m.centroid.y, 6.5, 0.001, 'centroid y');
});

test('an empty mask is refused, exactly as the device refuses it', () => {
  assert.throws(
    () => measureMask({ width: 8, height: 8, isForeground: () => false }),
    /no foreground pixels/
  );
});

test('mean colour is the mean inside the mask and ignores everything outside it', () => {
  const width = 10;
  const height = 10;
  const source = rgbMat({
    width, height,
    colourAt: (x, y) => (y < 5 ? [200, 100, 50] : [10, 20, 30]),
  });
  const mask = maskMat({ width, height, isForeground: (x, y) => y < 5 });
  try {
    const m = imageMeasurementsFromMats(source, mask);
    assert.equal(m.color.colorSpace, 'sRGB');
    assert.equal(m.color.statistic, 'mean');
    close(m.color.channels.red, 200, 0.001, 'red');
    close(m.color.channels.green, 100, 0.001, 'green');
    close(m.color.channels.blue, 50, 0.001, 'blue');
  } finally {
    source.delete();
    mask.delete();
  }
});

test('a flat field has no sharpness and a striped one has a great deal', () => {
  const width = 16;
  const height = 16;
  const all = maskMat({ width, height, isForeground: () => true });
  const flat = rgbMat({ width, height, colourAt: () => [128, 128, 128] });
  const striped = rgbMat({ width, height, colourAt: (x) => (x % 2 === 0 ? [255, 255, 255] : [0, 0, 0]) });
  try {
    const flatScore = imageMeasurementsFromMats(flat, all).sharpness;
    const stripedScore = imageMeasurementsFromMats(striped, all).sharpness;
    assert.equal(flatScore.metric, 'variance-of-laplacian');
    close(flatScore.score, 0, 1e-6, 'flat sharpness');
    assert.ok(stripedScore.score > 1000, `striped sharpness was ${stripedScore.score}`);
  } finally {
    all.delete();
    flat.delete();
    striped.delete();
  }
});

// --- cross-runtime semantics ------------------------------------------------
// Registry parity proves both hosts have an implementation. These prove the two
// implementations mean the same thing, which is a different and easier failure
// to miss.

test('a mask is read from the red channel, as the device reads it', () => {
  // The device decodes RGB and takes `pixels[index * 3]`; there is no alpha for
  // it to consider. The browser gets RGBA from a canvas and must make the same
  // choice — it used to threshold alpha, so any mask whose alpha and red
  // disagreed measured differently on the two hosts, silently.
  //
  // This fixture is deliberately a case where they disagree: opaque everywhere,
  // red only on the left half.
  const width = 10;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = (y * width + x) * 4;
      data[p] = x < 5 ? 255 : 0;  // red: left half only
      data[p + 1] = 0;
      data[p + 2] = 0;
      data[p + 3] = 255;          // alpha: everywhere
    }
  }

  const mat = maskMatOf({ width, height, data });
  try {
    const m = maskMeasurementsFromMat(mat);
    assert.equal(m.area.value, 5 * height, 'the red half is the mask');
    assert.notEqual(m.area.value, width * height, 'thresholding alpha would measure the whole image');
    assert.deepEqual(m.boundingBox, { x: 0, y: 0, width: 5, height: 4, unit: 'px' });
  } finally {
    mat.delete();
  }
});

test('an all-alpha, no-red image is an empty mask, not a full one', () => {
  const width = 6;
  const height = 6;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data[i * 4 + 3] = 255;
  const mat = maskMatOf({ width, height, data });
  try {
    assert.throws(() => maskMeasurementsFromMat(mat), /no foreground pixels/);
  } finally {
    mat.delete();
  }
});
