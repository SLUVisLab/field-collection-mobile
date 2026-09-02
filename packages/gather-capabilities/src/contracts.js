import { z } from 'zod';

/**
 * Serializable data contracts shared by capability definitions (io schemas) and
 * implementations (runtime guards). Native objects never appear here — only
 * durable references and plain values.
 *
 * Task profiles are part of the image-capability contract: they state which kind
 * of model an operation requires, independent of how the model is stored or run.
 */
export const IMAGE_TASK_PROFILES = Object.freeze({
  segmentationBinary: 'segmentation.binary.v1',
  classificationRanked: 'classification.ranked.v1',
});

const Sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/, 'expected a sha256:<hex> digest');

export const ImageAssetSchema = z
  .object({
    assetId: z.string().min(1),
    uri: z.string().min(1),
    path: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    mimeType: z.string().min(1),
    sha256: Sha256,
    orientation: z.string().nullable().optional(),
    capturedAt: z.string().nullable().optional(),
  })
  .passthrough();

export const MaskAssetSchema = z
  .object({
    assetId: z.string().min(1),
    uri: z.string().min(1),
    path: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.string().min(1),
    sha256: Sha256,
    sourceImageAssetId: z.string().min(1),
  })
  .passthrough();

/**
 * VideoAsset — specified in Phase 1, schema provided here for parity. No capability
 * produces it yet (video capture is Phase 4); it is advertised only when
 * `camera.recordVideo` lands.
 */
export const VideoAssetSchema = z
  .object({
    assetId: z.string().min(1),
    uri: z.string().min(1),
    path: z.string().min(1),
    mimeType: z.string().min(1),
    durationMs: z.number().int().positive(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    sha256: Sha256,
    capturedAt: z.string().nullable().optional(),
  })
  .passthrough();

/** A serializable reference to a resolved model (produced by the app's model store). */
export const ModelRefSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    revision: z.string().min(1),
    taskProfile: z.string().min(1),
  })
  .passthrough();

export const QuantitySchema = z.object({ value: z.number(), unit: z.string() }).passthrough();
