import { DataTypes, InterpolationFlags, OpenCV } from 'react-native-fast-opencv';
import { Images } from 'react-native-nitro-image';
import { ScientificContractError } from '../contracts.js';
import { logScientificStats } from './debug.js';

const rgbPixels = ({ buffer, pixelFormat, width, height }) => {
  const source = new Uint8Array(buffer);
  const offsets = {
    RGBA: [0, 1, 2, 4],
    BGRA: [2, 1, 0, 4],
    ARGB: [1, 2, 3, 4],
    ABGR: [3, 2, 1, 4],
    RGBX: [0, 1, 2, 4],
    BGRX: [2, 1, 0, 4],
    XRGB: [1, 2, 3, 4],
    XBGR: [3, 2, 1, 4],
    RGB: [0, 1, 2, 3],
    BGR: [2, 1, 0, 3],
  }[pixelFormat];
  if (!offsets || source.length !== width * height * offsets[3]) {
    throw new ScientificContractError('Decoded image pixels have an unsupported layout.', {
      code: 'GATHER_MODEL_TRANSFORM_INVALID',
    });
  }
  const pixels = new Uint8Array(width * height * 3);
  for (let index = 0; index < width * height; index += 1) {
    const sourceStart = index * offsets[3];
    const targetStart = index * 3;
    pixels[targetStart] = source[sourceStart + offsets[0]];
    pixels[targetStart + 1] = source[sourceStart + offsets[1]];
    pixels[targetStart + 2] = source[sourceStart + offsets[2]];
  }
  return pixels;
};

export const decodeRgbFile = async (asset) => {
  const uri = asset?.uri;
  const path = typeof uri === 'string' && uri.startsWith('file://') ? uri.slice('file://'.length) : asset?.path;
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new ScientificContractError('Image decoding requires a local file URI.', {
      code: 'GATHER_MODEL_TRANSFORM_INVALID',
    });
  }
  const image = await Images.loadFromFileAsync(path);
  const raw = await image.toRawPixelDataAsync();
  return { width: raw.width, height: raw.height, pixels: rgbPixels(raw) };
};

export const createOpenCvImageAdapter = () => ({
  async decodeResizeRgb({ image, resize, width, height }) {
    const source = await Images.loadFromFileAsync(image.uri.slice('file://'.length));
    let targetWidth = resize?.width ?? width;
    let targetHeight = resize?.height ?? height;
    if (resize?.shortestSide) {
      const scale = resize.shortestSide / Math.min(source.width, source.height);
      targetWidth = Math.round(source.width * scale);
      targetHeight = Math.round(source.height * scale);
    }
    const resized = await source.resizeAsync(targetWidth, targetHeight);
    const raw = await resized.toRawPixelDataAsync();
    logScientificStats('decodeResizeRgb', {
      assetWidth: image.width,
      assetHeight: image.height,
      sourceWidth: source.width,
      sourceHeight: source.height,
      pixelFormat: raw.pixelFormat,
      rawWidth: raw.width,
      rawHeight: raw.height,
    });
    return { width: raw.width, height: raw.height, pixels: rgbPixels(raw) };
  },
  resizeMask({ pixels, width, height, targetWidth, targetHeight }) {
    const source = OpenCV.Mat.createFromBuffer('uint8', height, width, 1, pixels);
    const resized = OpenCV.Mat.create(0, 0, DataTypes.CV_8UC1);
    try {
      OpenCV.resize(source, resized, OpenCV.Size.create(targetWidth, targetHeight), 0, 0, InterpolationFlags.INTER_NEAREST);
      return resized.toBuffer('uint8').buffer;
    } finally {
      source.release();
      resized.release();
    }
  },
  writeBinaryMaskPng({ pixels, width, height, uri }) {
    // Materialize an RGBA mask: foreground is opaque, background transparent, so
    // researchers can review the proposed region as an overlay. The RGB channels
    // carry the same 0/255 value, keeping the measurement adapter (which reads
    // the red channel) correct while the alpha channel drives the overlay.
    const source = pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels);
    const rgba = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      const value = source[index];
      rgba[index * 4] = value;
      rgba[index * 4 + 1] = value;
      rgba[index * 4 + 2] = value;
      rgba[index * 4 + 3] = value;
    }
    const mask = OpenCV.Mat.createFromBuffer('uint8', height, width, 4, rgba);
    try {
      mask.saveToFile(uri.replace(/^file:\/\//, ''), 'png', 1);
    } finally {
      mask.release();
    }
  },
});
