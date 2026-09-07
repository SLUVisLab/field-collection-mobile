/**
 * The browser's half of the image pipeline.
 *
 * The native adapter is OpenCV over React Native files; this is canvas over
 * blobs. Everything between them — `rgbToTensor`, `binaryMask`, the
 * ModelPackage's declared preprocessing and postprocessing steps — is shared,
 * because `createModelExecutor` already took its platform dependencies by
 * injection. That was the bet, and it held: **only these three methods and the
 * runtime differ.**
 */

const canvasOf = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const loadImage = (uri) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not decode the sample image.`));
    image.src = uri;
  });

/** RGBA from canvas, RGB for the tensor — the same shape the native path emits. */
const rgbFrom = (rgba) => {
  const pixels = new Uint8Array((rgba.length / 4) * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
    pixels[target] = rgba[source];
    pixels[target + 1] = rgba[source + 1];
    pixels[target + 2] = rgba[source + 2];
  }
  return pixels;
};

export const createWebImageAdapter = ({ files }) => ({
  async decodeResizeRgb({ image, resize, width, height }) {
    const source = await loadImage(image.uri);
    let targetWidth = resize?.width ?? width ?? source.naturalWidth;
    let targetHeight = resize?.height ?? height ?? source.naturalHeight;
    if (resize?.shortestSide) {
      const scale = resize.shortestSide / Math.min(source.naturalWidth, source.naturalHeight);
      targetWidth = Math.round(source.naturalWidth * scale);
      targetHeight = Math.round(source.naturalHeight * scale);
    }
    const context = canvasOf(targetWidth, targetHeight).getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    const { data } = context.getImageData(0, 0, targetWidth, targetHeight);
    return { width: targetWidth, height: targetHeight, pixels: rgbFrom(data) };
  },

  /** Nearest-neighbour on purpose: a mask is labels, and interpolation invents. */
  resizeMask({ pixels, width, height, targetWidth, targetHeight }) {
    const out = new Uint8Array(targetWidth * targetHeight);
    for (let y = 0; y < targetHeight; y += 1) {
      const sourceY = Math.min(height - 1, Math.floor((y * height) / targetHeight));
      for (let x = 0; x < targetWidth; x += 1) {
        const sourceX = Math.min(width - 1, Math.floor((x * width) / targetWidth));
        out[y * targetWidth + x] = pixels[sourceY * width + sourceX];
      }
    }
    return out;
  },

  async writeBinaryMaskPng({ pixels, width, height, uri }) {
    const canvas = canvasOf(width, height);
    const context = canvas.getContext('2d');
    const rgba = context.createImageData(width, height);
    for (let index = 0; index < pixels.length; index += 1) {
      const on = pixels[index] >= 128;
      const offset = index * 4;
      rgba.data[offset] = 255;
      rgba.data[offset + 1] = 255;
      rgba.data[offset + 2] = 255;
      // Foreground in alpha, matching what the mobile mask asset carries.
      rgba.data[offset + 3] = on ? 255 : 0;
    }
    context.putImageData(rgba, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    files.write(uri, new Uint8Array(await blob.arrayBuffer()));
  },
});
