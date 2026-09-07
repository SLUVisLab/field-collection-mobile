/**
 * Gather's Components, rendered for the web.
 *
 * The **schemas are not defined here.** They live once, in
 * `src/a2ui/mobile/componentApis.js`, and this module imports them — because
 * two definitions of one contract is exactly the second registry this project
 * has removed everywhere else, and these two had silently drifted:
 *
 * ```text
 * CameraView   the renderer's copy lacked `capture`  → the authored capture
 *                                                      binding was dropped
 * Flow         the renderer's copy lacked `fallback` → a Flow with no matching
 *                                                      view rendered nothing
 * ```
 *
 * Both are properties the canonical Segment & Measure Tool authors, so the
 * Composer preview was running a different contract from the device.
 *
 * `createComponentImplementation` binds through the same deep generic binder
 * the app uses, so a path-bound `DynamicValue` arrives with its writer —
 * `capture` becomes `props.setCapture`. That is upstream A2UI's own two-way
 * binding, not a Gather mechanism, which is why sharing the schema was enough
 * and no binding adapter was needed.
 */
import React, { useRef, useState } from 'react';

import { createComponentImplementation as bindUpstreamComponent } from '@a2ui/react/v0_9';
import { CommonSchemas } from '@a2ui/web_core/v0_9';
import { z } from 'zod';
import {
  Button as SharedButton,
  CameraView,
  MediaGallery,
  MultiImageCapture,
  ImageOverlay,
  InstrumentError,
  OutputReview,
  ProcessingView,
} from 'gather-components';

import { ButtonApi } from '@a2ui/web_core/v0_9/basic_catalog';

import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS, resolveFlowView } from 'gather-catalog';

import { ACTION_FUNCTION_CALL_DOC } from '../../../src/a2ui/actionAdapter.js';
import { withFunctionCallActions } from '../../../src/a2ui/functionCallProps.js';
import { previewFiles } from './preview/previewRuntime.js';

import {
  cameraViewApi,
  flowApi,
  gatherCaptureApi,
  imageOverlayApi,
  instrumentErrorApi,
  mediaGalleryApi,
  multiImageCaptureApi,
  outputReviewApi,
  processingViewApi,
} from '../../../src/a2ui/mobile/componentApis.js';

/**
 * Upstream's component factory, plus Gather's action-position `functionCall`
 * semantics.
 *
 * Upstream binds a value-position `functionCall` reactively and knows nothing
 * about `resultPath`, which is Gather's way of saying where an awaited result
 * goes. Without this the renderer ran an authored Tool's calls perfectly and
 * dropped every result on the floor: `gather_persistAsset` executed,
 * `/working/image` stayed null, and `image_segment` had nothing to segment.
 * Silent, because nothing failed.
 *
 * Composed into the factory rather than replacing upstream's binding: the
 * generic binder still does all the work, and `withFunctionCallActions` — the
 * same module the mobile binder uses — substitutes handlers for the properties
 * upstream does not know how to run.
 */
const createComponentImplementation = (api, Render) =>
  bindUpstreamComponent(api, (bound) =>
    Render({ ...bound, props: withFunctionCallActions({ context: bound.context, props: bound.props }) })
  );

const action = (name, statePath, extra) => ({ event: { name, context: { statePath, ...extra } } });

const DEFAULT_STATE_PATH = '/gather';

/**
 * How an author supplies representative imagery while previewing a Tool.
 *
 * The Composer frames the renderer without `allow="camera"`, so `getUserMedia`
 * is refused and the shutter has nothing to grab. This is a **preview-host
 * acquisition detail**, not a new A2UI concept: it produces the same capture
 * descriptor the camera would, so from `gather_persistAsset` onward the Tool
 * cannot tell where the image came from — native camera, browser camera, or a
 * file chosen here.
 *
 * That is why there is no SampleImage component and no authoring-only
 * FunctionCall: the Tool document is identical either way.
 */
function SampleImageInput({ onSample }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const uri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
      });
      const { width, height } = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('That file is not an image the browser can decode.'));
        image.src = uri;
      });
      await onSample({ uri, path: `preview/${file.name}`, contentType: file.type || 'image/jpeg', width, height });
    } finally {
      setBusy(false);
    }
  };

  return (
    <span>
      <input ref={inputRef} type="file" accept="image/*" onChange={choose} style={{ display: 'none' }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
              data-testid="camera-sample-image">
        {busy ? 'Loading…' : 'Choose sample image'}
      </button>
    </span>
  );
}

export const Flow = createComponentImplementation(flowApi, ({ props, buildChild }) => {
  const view = resolveFlowView(props);
  return view ? buildChild(view) : null;
});

// The A2UI binding wrapper is the only web-specific part: it resolves bound data
// and dispatches actions, then delegates all rendering to the shared components.
export const GatherCapture = createComponentImplementation(gatherCaptureApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  return (
    <CameraView
      onCapture={(capture) => context.dispatchAction(action(GATHER_ACTION_IDS.capture, statePath, capture ? { capture } : undefined))}
    />
  );
});

// CameraView: the standard still-photo acquisition surface. Same semantic
// contract as native — acquisition is Component-owned and emits a plain local
// capture descriptor.
export const GatherCameraView = createComponentImplementation(cameraViewApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  // Both paths, exactly as the device does: `setCapture` serves an authored
  // composition binding `capture` to a path, the action serves a registered
  // handler. A Tool that uses one must not be broken by the other's absence.
  const publish = (capture) => {
    if (capture) props.setCapture?.(capture);
    context.dispatchAction(action(GATHER_ACTION_IDS.capture, statePath, capture ? { capture } : undefined));
  };
  return <CameraView onCapture={publish} trailing={<SampleImageInput onSample={publish} />} />;
});

export const GatherMediaGallery = createComponentImplementation(mediaGalleryApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  return (
    <MediaGallery
      items={Array.isArray(props.items) ? props.items : []}
      allowSelect={props.allowSelect ?? false}
      allowRemove={props.allowRemove ?? false}
      allowReorder={props.allowReorder ?? false}
      columns={props.columns ?? 3}
      onRemove={(_item, index) => context.dispatchAction(action(GATHER_ACTION_IDS.mediaChanged, statePath, { index, change: 'remove' }))}
      onReorder={(next) => context.dispatchAction(action(GATHER_ACTION_IDS.mediaChanged, statePath, { items: next, change: 'reorder' }))}
      onSelect={(_item, index) => context.dispatchAction(action(GATHER_ACTION_IDS.mediaSelected, statePath, { index }))}
      onBack={() => context.dispatchAction(action(GATHER_ACTION_IDS.mediaBack, statePath))}
      onDone={() => context.dispatchAction(action(GATHER_ACTION_IDS.mediaDone, statePath))}
    />
  );
});

export const GatherMultiImageCapture = createComponentImplementation(multiImageCaptureApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  return (
    <MultiImageCapture
      value={Array.isArray(props.value) ? props.value : []}
      minItems={props.minItems ?? 0}
      maxItems={props.maxItems ?? null}
      allowRemove={props.allowRemove ?? true}
      allowReorder={props.allowReorder ?? false}
      onCapture={(capture) => context.dispatchAction(action(GATHER_ACTION_IDS.mediaCaptured, statePath, capture ? { capture } : undefined))}
      onChange={(next) => context.dispatchAction(action(GATHER_ACTION_IDS.mediaChanged, statePath, { items: next, change: 'set' }))}
      onDone={() => context.dispatchAction(action(GATHER_ACTION_IDS.mediaDone, statePath))}
    />
  );
});

export const GatherImageOverlay = createComponentImplementation(imageOverlayApi, ({ props }) => {
  // A preview mask lives in the session store, not at a URL the browser knows.
  const resolveAsset = (asset) =>
    asset?.uri ? { ...asset, uri: previewFiles.resolveUrl(asset.uri) } : asset;
  if (!props.image?.uri) return null;
  return (
    <ImageOverlay
      image={resolveAsset(props.image)}
      overlay={resolveAsset(props.segmentation?.mask ?? null)}
    />
  );
});

export const GatherOutputReview = createComponentImplementation(outputReviewApi, ({ props }) => {
  if (!props.data) return null;
  return <OutputReview data={props.data} display={props.display} />;
});

export const GatherProcessingView = createComponentImplementation(processingViewApi, ({ props }) => (
  <ProcessingView image={props.image} />
));

export const GatherInstrumentError = createComponentImplementation(instrumentErrorApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  const retake = () => context.dispatchAction(action(GATHER_ACTION_IDS.retake, statePath));
  return <InstrumentError message={props.error} onRetake={retake} />;
});

/**
 * The Basic Catalog `Button`, bound by Gather.
 *
 * Not a Gather Component — `Button` is upstream A2UI vocabulary. But every
 * action-position `functionCall` in an authored Tool hangs off one, and
 * upstream's own implementation binds internally, so there is no way to give it
 * `resultPath` from outside. It invoked `gather_persistAsset` perfectly and
 * dropped the result, leaving the next call with nothing.
 *
 * So the renderer binds `ButtonApi` itself and renders Gather's Button, exactly
 * as `src/a2ui/mobile/basicCatalog.js` does for the same reason. The two hosts
 * now share both the visual and the action semantics, which is the point: a
 * preview of a Gather Tool should press the same button the device does.
 */
/**
 * `Button` with Gather's action contract described on the property that carries
 * it.
 *
 * `resultPath` belongs to an **action**, not to any one function, so it is
 * documented here rather than repeated in five function descriptions that would
 * drift apart. The prose itself lives once, in actionAdapter.js beside the key.
 */
const describeButtonAction = () => {
  // Zod exposes an object schema's shape differently across versions and
  // bundles, so reach for it defensively: an undescribed Button is a worse
  // outcome than a missing sentence, but a crashing catalog is worse than both.
  const shape = ButtonApi.schema?.shape ?? ButtonApi.schema?._def?.shape;
  const resolved = typeof shape === 'function' ? shape() : shape;
  const action = resolved?.action;
  if (!action?.describe || typeof ButtonApi.schema.extend !== 'function') return ButtonApi;
  return { ...ButtonApi, schema: ButtonApi.schema.extend({ action: action.describe(ACTION_FUNCTION_CALL_DOC) }) };
};

const gatherButtonApi = describeButtonAction();

export const GatherButton = createComponentImplementation(
  gatherButtonApi,
  ({ props, context, buildChild }) => {
    const variant =
      props.variant === 'primary' ? 'primary' : props.variant === 'borderless' ? 'borderless' : 'secondary';
    // The visible label is always the rendered child; this is only the
    // accessible name, read best-effort from a child Text.
    const childText = props.child ? context?.surfaceComponents?.get(props.child)?.properties?.text : undefined;
    return (
      <SharedButton
        onPress={props.action}
        variant={variant}
        disabled={props.isValid === false}
        accessibilityLabel={typeof childText === 'string' ? childText : undefined}
      >
        {props.child ? buildChild(props.child) : null}
      </SharedButton>
    );
  }
);
