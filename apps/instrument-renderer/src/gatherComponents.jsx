import React from 'react';
import { createComponentImplementation } from '@a2ui/react/v0_9';
import { CommonSchemas } from '@a2ui/web_core/v0_9';
import { z } from 'zod';

import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS } from 'gather-catalog';

const GatherCaptureApi = {
  name: GATHER_COMPONENT_IDS.capture,
  schema: z.object({
    phase: CommonSchemas.DynamicString.optional(),
    statePath: z.string().optional(),
  }).strict(),
};

const MaskReviewApi = {
  name: GATHER_COMPONENT_IDS.maskReview,
  schema: z.object({
    phase: CommonSchemas.DynamicString.optional(),
    image: CommonSchemas.DynamicValue.optional(),
    segmentation: CommonSchemas.DynamicValue.optional(),
    classification: CommonSchemas.DynamicValue.optional(),
    result: CommonSchemas.DynamicValue.optional(),
    error: CommonSchemas.DynamicString.optional(),
    statePath: z.string().optional(),
  }).strict(),
};

const event = (name, statePath) => ({ event: { name, context: { statePath } } });

const DEFAULT_STATE_PATH = '/gather';

export const GatherCapture = createComponentImplementation(GatherCaptureApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  // Treat an unbound/empty phase (e.g. Composer authoring) as capture-ready so
  // the component is always visible; hide only once a later phase is active.
  const phase = props.phase || 'capture';
  if (phase !== 'capture') return null;
  return (
    <button type="button" onClick={() => context.dispatchAction(event(GATHER_ACTION_IDS.capture, statePath))}>
      Capture fixture image
    </button>
  );
});

export const MaskReview = createComponentImplementation(MaskReviewApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  const phase = props.phase || '';

  if (phase === 'error') return <p role="alert">{props.error}</p>;

  if (phase === 'accepted' && props.result) {
    return (
      <section className="gather-status-panel">
        <h2>Result accepted</h2>
        <p>Area: {props.result.measurements.area.value} {props.result.measurements.area.unit}</p>
        <button type="button" onClick={() => context.dispatchAction(event(GATHER_ACTION_IDS.retake, statePath))}>Retake</button>
      </section>
    );
  }

  if (phase === 'review-mask' && props.image && props.segmentation) {
    return (
      <section className="gather-status-panel">
        <div className="mask-preview">
          <img src={props.image.uri} alt="Captured fixture" />
          <img src={props.segmentation.mask.uri} alt="Proposed mask" />
        </div>
        <p>Review the proposed mask before accepting measurements.</p>
        <button type="button" onClick={() => context.dispatchAction(event(GATHER_ACTION_IDS.accept, statePath))}>Accept mask</button>
        <button type="button" onClick={() => context.dispatchAction(event(GATHER_ACTION_IDS.retake, statePath))}>Retake</button>
      </section>
    );
  }

  // Authoring preview or an intermediate processing phase: stay visible.
  return (
    <section className="gather-status-panel">
      <p>{phase ? `Mask review — ${phase}\u2026` : 'Mask review — awaiting capture.'}</p>
    </section>
  );
});
