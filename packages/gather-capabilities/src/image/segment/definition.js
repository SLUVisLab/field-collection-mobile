import { z } from 'zod';

import { defineCapability } from '../../defineCapability.js';
import { IMAGE_TASK_PROFILES, ImageAssetSchema, MaskAssetSchema, ModelRefSchema } from '../../contracts.js';

// `modelRef` is optional: omitting it is how an author says "whatever model
// this Gather build considers current for this capability". The app's default
// policy supplies one before execution, so the result and its provenance carry
// a concrete ref either way.
export const SegmentInputSchema = z.object({
  image: ImageAssetSchema,
  modelRef: ModelRefSchema.optional(),
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
  acceptedModelProfiles: [IMAGE_TASK_PROFILES.segmentationBinary],
  input: SegmentInputSchema,
  output: SegmentationResultSchema,
  platforms: ['android', 'ios', 'web'],
});
