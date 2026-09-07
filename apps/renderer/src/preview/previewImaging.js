/**
 * Browser imaging for the preview backend.
 *
 * Deliberately small: load an image, draw a deterministic mask, count mask
 * pixels. Everything here is ordinary canvas work, so the measurement built on
 * it is a **real** measurement of a real image — of a simulated mask, which is
 * a different claim and one the ledger keeps separate.
 */
import { digestBytes } from 'gather-hashing';

// Set by previewRuntime so imaging can load a `preview:` URI. Injected rather
// than imported to keep this module free of the file store.
let resolveUri = (uri) => uri;
export const setPreviewUriResolver = (resolver) => {
  resolveUri = resolver;
};

const loadImage = (uri) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Preview could not load image: ${uri.slice(0, 64)}…`));
    image.src = resolveUri(uri);
  });

const canvasOf = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const bytesOfDataUri = (dataUri) => {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const describeImage = async (uri) => {
  const image = await loadImage(uri);
  return { width: image.naturalWidth, height: image.naturalHeight };
};

/**
 * A centred ellipse covering a fixed fraction of the frame.
 *
 * Deterministic on purpose — the same capture always yields the same mask, so
 * an authoring session is reproducible and a changed measurement means the
 * author changed something. It is not segmentation and never pretends to be.
 */
export const drawPreviewMask = async ({ uri }) => {
  const { width, height } = await describeImage(uri);
  const canvas = canvasOf(width, height);
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.ellipse(width / 2, height / 2, width * 0.3, height * 0.25, 0, 0, Math.PI * 2);
  context.fill();
  const dataUri = canvas.toDataURL('image/png');
  const bytes = bytesOfDataUri(dataUri);
  return { uri: dataUri, width, height, sha256: digestBytes(bytes), byteLength: bytes.length };
};

/** Real pixel work: counts mask coverage the same way a measurement should. */
export const measureMaskCoverage = async ({ uri }) => {
  const image = await loadImage(uri);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const context = canvasOf(width, height).getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  let covered = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
    if (data[i + 3] < 128) continue;
    covered += 1;
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    sumX += x;
    sumY += y;
  }
  if (covered === 0) {
    return { covered: 0, width, height, boundingBox: null, centroid: null };
  }
  return {
    covered,
    width,
    height,
    boundingBox: { width: maxX - minX + 1, height: maxY - minY + 1, unit: 'px' },
    centroid: { x: Math.round(sumX / covered), y: Math.round(sumY / covered), unit: 'px' },
  };
};
