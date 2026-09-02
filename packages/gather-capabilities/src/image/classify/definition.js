import { z } from 'zod';

import { defineCapability } from '../../defineCapability.js';
import { ImageAssetSchema, ModelRefSchema } from '../../contracts.js';

export const ClassifyInputSchema = z.object({
  image: ImageAssetSchema,
  modelRef: ModelRefSchema,
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
  input: ClassifyInputSchema,
  output: ClassificationResultSchema,
  platforms: ['android', 'ios', 'web'],
});
