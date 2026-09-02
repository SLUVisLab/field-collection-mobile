import { z } from 'zod';

import { defineCapability } from '../defineCapability.js';
import { ImageAssetSchema, MaskAssetSchema, QuantitySchema } from '../contracts.js';

const MaskInput = z.object({ mask: MaskAssetSchema });
const ImageInput = z.object({ image: ImageAssetSchema, mask: MaskAssetSchema });

const measureDef = ({ id, title, description, input, output }) =>
  defineCapability({
    id,
    version: 1,
    title,
    description,
    group: 'Measurement',
    subcategory: 'Geometry',
    kind: 'processing',
    input,
    output,
    platforms: ['android', 'ios', 'web'],
  });

// `measure.*` describes quantitative meaning independent of the source modality.
export const areaDefinition = measureDef({
  id: 'measure.area',
  title: 'Measure area',
  description: 'Area of the masked region, in pixel units.',
  input: MaskInput,
  output: QuantitySchema,
});

export const perimeterDefinition = measureDef({
  id: 'measure.perimeter',
  title: 'Measure perimeter',
  description: 'Perimeter of the masked region, in pixel units.',
  input: MaskInput,
  output: QuantitySchema,
});

export const boundingBoxDefinition = measureDef({
  id: 'measure.boundingBox',
  title: 'Measure bounding box',
  description: 'Axis-aligned bounding box of the masked region.',
  input: MaskInput,
  output: z.object({ width: z.number(), height: z.number(), unit: z.string() }).passthrough(),
});

export const centroidDefinition = measureDef({
  id: 'measure.centroid',
  title: 'Measure centroid',
  description: 'Centroid of the largest connected component of the mask.',
  input: MaskInput,
  output: z.object({ x: z.number(), y: z.number() }).passthrough(),
});

export const colorDefinition = measureDef({
  id: 'measure.color',
  title: 'Measure color',
  description: 'Mean sRGB color of the image within the mask.',
  input: ImageInput,
  output: z.unknown(),
});

export const sharpnessDefinition = measureDef({
  id: 'measure.sharpness',
  title: 'Measure sharpness',
  description: 'Variance-of-Laplacian sharpness score within the mask.',
  input: ImageInput,
  output: z.unknown(),
});

export const measureDefinitions = [
  areaDefinition,
  perimeterDefinition,
  boundingBoxDefinition,
  centroidDefinition,
  colorDefinition,
  sharpnessDefinition,
];
