/**
 * The browser's measurement adapter — OpenCV, same as the device.
 *
 * A Capability is authorable only if both runtimes execute its contract, and the
 * strongest form of that is not "equivalent meaning, carefully matched" but the
 * *same implementation*. So this mirrors
 * `src/compute/runtime/openCvMeasurementAdapter.js` call for call:
 *
 * ```text
 * device    react-native-fast-opencv   OpenCV 4.12.0
 * browser   vendor/opencv              OpenCV 4.12.0, built here
 * ```
 *
 * The browser half used to be `@techstark/opencv-js`, which forced the renderer
 * to grant `'unsafe-eval'`: Embind builds its invokers with `new Function`
 * unless Emscripten is told otherwise at compile time. `tools/opencv-build`
 * tells it otherwise. Same OpenCV version, same call sequence, same numbers —
 * the parity claim above is unchanged by where the bytes come from.
 *
 * which is the pattern inference already uses — `onnxruntime-react-native` and
 * `onnxruntime-web`, one library family, two bindings, one set of numbers.
 *
 * An earlier attempt reimplemented the arithmetic by hand. It matched OpenCV on
 * simple shapes and over-counted the contours of holes, because reproducing
 * `findContours` means reproducing Suzuki–Abe border following — which is to say
 * it meant writing a worse copy of the function below.
 *
 * What is *not* shared is decoding: the device reads files through
 * `decodeRgbFile`, the browser draws to a canvas. Only that differs.
 */
import { loadOpenCv } from './openCvModule.js';

/**
 * The OpenCV namespace, `null` until the module has loaded.
 *
 * It is module-scope rather than threaded through every function so that the
 * measurement helpers below stay synchronous — they are the arithmetic, and
 * they read better as arithmetic. Everything reachable from outside this file
 * awaits `whenReady()` first, which is what makes that safe.
 */
let cv = null;

/** OpenCV loads lazily and initialises its WASM asynchronously; entry points wait. */
let ready = null;
const whenReady = () => {
  ready ??= loadOpenCv().then((loaded) => {
    cv = loaded;
  });
  return ready;
};

const loadImage = (uri) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not decode image at ${String(uri).slice(0, 60)}`));
    image.src = uri;
  });

/** RGBA pixels for an asset, via a canvas — the browser's half of decoding. */
const pixelsOf = async ({ uri }, resolveUri) => {
  const image = await loadImage(resolveUri ? resolveUri(uri) : uri);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  return { width, height, data: context.getImageData(0, 0, width, height).data };
};

/** Three-channel RGB, dropping alpha — the shape `decodeRgbFile` hands the device. */
const rgbMatOf = ({ width, height, data }) => {
  const rgb = new Uint8Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgb[pixel * 3] = data[pixel * 4];
    rgb[pixel * 3 + 1] = data[pixel * 4 + 1];
    rgb[pixel * 3 + 2] = data[pixel * 4 + 2];
  }
  return cv.matFromArray(height, width, cv.CV_8UC3, rgb);
};

/**
 * Single-channel binary mask, read from the **red** channel.
 *
 * This is a parity detail that has nothing to do with which OpenCV is used and
 * was wrong before: the device builds its mask from `pixels[index * 3]` — red —
 * while the browser preview thresholded alpha. Those disagree for any mask whose
 * alpha and colour differ, and the disagreement would have survived the switch
 * to OpenCV.js untouched.
 */
export const maskMatOf = ({ width, height, data }) => {
  const binary = new Uint8Array(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) binary[pixel] = data[pixel * 4];
  return cv.matFromArray(height, width, cv.CV_8UC1, binary);
};

const releaseAll = (objects) => objects.forEach((object) => object?.delete?.());

/**
 * The measurements themselves, over Mats — no canvas, no DOM.
 *
 * Split from decoding so the OpenCV call sequence is the thing tests exercise,
 * in Node, against Mats built by hand. A test that reproduced these calls
 * instead of running them would be checking its own copy.
 */
export const maskMeasurementsFromMat = (binary) => {
  const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    const labels = new cv.Mat();
    const stats = new cv.Mat();
    const centroids = new cv.Mat();
    try {
      const area = cv.countNonZero(binary);
      if (area === 0) throw new Error('Mask contains no foreground pixels.');

      cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      let perimeter = 0;
      for (let index = 0; index < contours.size(); index += 1) {
        const contour = contours.get(index);
        perimeter += cv.arcLength(contour, true);
        contour.delete();
      }

      const rectangle = cv.boundingRect(binary);
      cv.connectedComponentsWithStats(binary, labels, stats, centroids);
      // Component 0 is the background; the largest of the rest is the subject,
      // which is what the device's centroid means.
      let component = 1;
      for (let index = 2; index < stats.rows; index += 1) {
        if (stats.intAt(index, cv.CC_STAT_AREA) > stats.intAt(component, cv.CC_STAT_AREA)) {
          component = index;
        }
      }

      return {
        area: { value: area, unit: 'px2' },
        perimeter: { value: perimeter, unit: 'px', boundary: 'all-contours' },
        boundingBox: {
          x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height, unit: 'px',
        },
        centroid: {
          x: centroids.doubleAt(component, 0),
          y: centroids.doubleAt(component, 1),
          unit: 'px',
          semantics: 'largest-connected-foreground-component',
        },
      };
    } finally {
      releaseAll([contours, hierarchy, labels, stats, centroids]);
    }
};

export const imageMeasurementsFromMats = (source, binary) => {
  const mean = new cv.Mat();
    const stddev = new cv.Mat();
    const grey = new cv.Mat();
    const laplacian = new cv.Mat();
    try {
      cv.meanStdDev(source, mean, stddev, binary);
      const channels = [mean.doubleAt(0, 0), mean.doubleAt(1, 0), mean.doubleAt(2, 0)];

      cv.cvtColor(source, grey, cv.COLOR_RGB2GRAY);
      cv.Laplacian(grey, laplacian, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT);
      cv.meanStdDev(laplacian, mean, stddev, binary);
      const laplacianStdDev = stddev.doubleAt(0, 0);

      return {
        color: {
          colorSpace: 'sRGB',
          statistic: 'mean',
          channels: { red: channels[0], green: channels[1], blue: channels[2] },
        },
        sharpness: { metric: 'variance-of-laplacian', score: laplacianStdDev ** 2 },
      };
    } finally {
      releaseAll([mean, stddev, grey, laplacian]);
    }
};

/**
 * @param {{ resolveUri?: (uri: string) => string }} options
 *   `resolveUri` maps the preview's own `preview:` URIs to something a browser
 *   can fetch; assets that already carry a real URL pass straight through.
 */
export const createOpenCvWebMeasurementAdapter = ({ resolveUri } = {}) => ({
  async maskMeasurements(mask) {
    await whenReady();
    const binary = maskMatOf(await pixelsOf(mask, resolveUri));
    try {
      return maskMeasurementsFromMat(binary);
    } finally {
      binary.delete();
    }
  },

  async imageMeasurements(image, mask) {
    await whenReady();
    const [imagePixels, maskPixels] = await Promise.all([
      pixelsOf(image, resolveUri),
      pixelsOf(mask, resolveUri),
    ]);
    const source = rgbMatOf(imagePixels);
    const binary = maskMatOf(maskPixels);
    try {
      return imageMeasurementsFromMats(source, binary);
    } finally {
      releaseAll([source, binary]);
    }
  },
});

/** Exposed so tests can wait for the same WASM the adapter waits for. */
export const openCvReady = whenReady;
