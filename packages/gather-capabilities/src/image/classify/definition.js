import { z } from 'zod';

import { defineCapability } from '../../defineCapability.js';
import { IMAGE_TASK_PROFILES, ImageAssetSchema, ModelRefSchema } from '../../contracts.js';

// `modelRef` is optional: omitting it is how an author says "whatever model
// this Gather build considers current for this capability". The app's default
// policy supplies one before execution, so the result and its provenance carry
// a concrete ref either way.
export const ClassifyInputSchema = z.object({
  image: ImageAssetSchema,
  modelRef: ModelRefSchema.optional(),
});

export const ClassificationResultSchema = z.object({
  image: ImageAssetSchema,
  model: ModelRefSchema,
  ranked: z.array(z.object({ label: z.string(), score: z.number() })),
});

export const classifyDefinition = defineCapability({
  id: 'image.classify',
  version: 1,
  title: 'Classify image',
  description: 'Produce ranked labels for an image.',
  group: 'Image',
  subcategory: 'Analysis',
  kind: 'inference',
  acceptedModelProfiles: [IMAGE_TASK_PROFILES.classificationRanked],
  input: ClassifyInputSchema,
  output: ClassificationResultSchema,
  platforms: ['android', 'ios', 'web'],
});
