import { z } from 'zod';

import { defineCapability } from '../../defineCapability.js';
import { ImageAssetSchema, MaskAssetSchema, ModelRefSchema } from '../../contracts.js';

export const SegmentInputSchema = z.object({
  image: ImageAssetSchema,
  modelRef: ModelRefSchema,
});

export const SegmentationResultSchema = z.object({
  image: ImageAssetSchema,
  model: ModelRefSchema,
  mask: MaskAssetSchema,
  threshold: z.number().nullable().optional(),
});

export const segmentDefinition = defineCapability({
  id: 'image.segment',
  version: 1,
  title: 'Segment image',
  description: 'Generate a segmentation mask for an image.',
  group: 'Image',
  subcategory: 'Analysis',
  kind: 'inference',
  input: SegmentInputSchema,
  output: SegmentationResultSchema,
  platforms: ['android', 'ios', 'web'],
});
