import { CommonSchemas } from '@a2ui/web_core/v0_9/common-schemas';
import { ButtonApi, ColumnApi, ImageApi, TextApi } from '@a2ui/web_core/v0_9/basic_catalog';
import { z } from 'zod';

import { GATHER_COMPONENT_IDS } from 'gather-catalog';

/**
 * Component **API declarations** for the mobile renderer — what a Tool may
 * register, with no implementation attached.
 *
 * Kept free of JSX so catalogs can be built (and Tools driven) in plain Node,
 * mirroring the render-free `basicCatalogModel.js` / `mediaModel.js` split. The
 * implementations that pair with these live in `basicCatalog.js` (upstream A2UI
 * vocabulary) and `gatherComponents.js` (Gather vocabulary).
 */

/** Upstream A2UI Basic Catalog APIs the mobile renderer implements. */
export const mobileBasicApis = [ColumnApi, TextApi, ButtonApi, ImageApi];

// Flow: the data-driven View selector. Presentation only — a host-side
// FlowController decides which View is active.
export const flowApi = {
  name: GATHER_COMPONENT_IDS.flow,
  schema: z.object({
    current: CommonSchemas.DynamicString,
    views: z.array(z.object({ when: z.string(), view: z.string() }).strict()).min(1),
    fallback: z.string().optional(),
  }).strict(),
};

// CameraView: the standard still-photo acquisition surface. Acquisition is
// Component-owned (Phase 3) — there is no `camera.*` capability. The component
// emits a plain local capture descriptor; the Tool's controller turns it into a
// durable ImageAsset.
export const cameraViewApi = {
  name: GATHER_COMPONENT_IDS.cameraView,
  schema: z
    .object({
      statePath: z.string().optional(),
      /**
       * Where the capture descriptor lands, e.g. `{ path: '/working/capture' }`.
       *
       * This is the upstream Component-output mechanism, not a Gather
       * invention: the binder injects a `setCapture` writer for any
       * `DynamicValue` prop bound to a path, exactly as it does for a
       * `TextField`'s `value`. It is what lets an **authored** composition
       * receive a capture with no registered handler — the event below needs
       * one, so handler-free compositions could not use the camera at all.
       */
      capture: CommonSchemas.DynamicValue.optional(),
    })
    .strict(),
};

// MediaGallery: manages a collection of durable media. Composer-visible so an
// author can compose CameraView + MediaGallery + Flow directly instead of
// configuring MultiImageCapture — the escape hatch that keeps the convenience
// Component from hiding its primitives.
export const mediaGalleryApi = {
  name: GATHER_COMPONENT_IDS.mediaGallery,
  schema: z.object({
    items: CommonSchemas.DynamicValue.optional(),
    statePath: z.string(),
    allowSelect: z.boolean().optional(),
    allowRemove: z.boolean().optional(),
    allowReorder: z.boolean().optional(),
    columns: z.number().int().min(1).optional(),
  }).strict(),
};

// MultiImageCapture: one control collecting a bounded ImageAsset[]. Cardinality
// is a Component input because it affects interaction; the host owns the rule.
export const multiImageCaptureApi = {
  name: GATHER_COMPONENT_IDS.multiImageCapture,
  schema: z.object({
    value: CommonSchemas.DynamicValue.optional(),
    statePath: z.string(),
    minItems: z.number().int().min(0).optional(),
    maxItems: z.number().int().min(1).optional(),
    allowRemove: z.boolean().optional(),
    allowReorder: z.boolean().optional(),
  }).strict(),
};

export const imageOverlayApi = {
  name: GATHER_COMPONENT_IDS.imageOverlay,
  schema: z.object({
    image: CommonSchemas.DynamicValue.optional(),
    segmentation: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

export const outputReviewApi = {
  name: GATHER_COMPONENT_IDS.outputReview,
  schema: z.object({
    data: CommonSchemas.DynamicValue.optional(),
    display: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

export const processingViewApi = {
  name: GATHER_COMPONENT_IDS.processingView,
  schema: z.object({
    image: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

export const instrumentErrorApi = {
  name: GATHER_COMPONENT_IDS.instrumentError,
  schema: z.object({
    error: CommonSchemas.DynamicString.optional(),
    statePath: z.string(),
  }).strict(),
};

/** Gather's Composer-visible components — registerable by any Tool. */
export const gatherComponentApis = [
  flowApi,
  cameraViewApi,
  mediaGalleryApi,
  multiImageCaptureApi,
  imageOverlayApi,
  outputReviewApi,
  processingViewApi,
  instrumentErrorApi,
];

/**
 * Segment & Measure's bespoke capture surface. It predates `CameraView` and is
 * kept only for that reference instrument; new Tools use `cameraViewApi`.
 */
export const gatherCaptureApi = {
  name: GATHER_COMPONENT_IDS.capture,
  schema: z.object({ statePath: z.string() }).strict(),
};

export const segmentAndMeasureApis = [...gatherComponentApis, gatherCaptureApi];
