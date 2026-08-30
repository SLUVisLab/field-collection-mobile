import React from 'react';
import { createComponentImplementation } from '@a2ui/react/v0_9';
import { CommonSchemas } from '@a2ui/web_core/v0_9';
import { z } from 'zod';

import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS } from 'gather-catalog';

const GatherCaptureApi = {
  name: GATHER_COMPONENT_IDS.capture,
  schema: z.object({
    phase: CommonSchemas.DynamicString,
    statePath: z.string(),
  }).strict(),
};

const MaskReviewApi = {
  name: GATHER_COMPONENT_IDS.maskReview,
  schema: z.object({
    phase: CommonSchemas.DynamicString,
    image: CommonSchemas.DynamicValue.optional(),
    segmentation: CommonSchemas.DynamicValue.optional(),
    classification: CommonSchemas.DynamicValue.optional(),
    result: CommonSchemas.DynamicValue.optional(),
    error: CommonSchemas.DynamicString.optional(),
    statePath: z.string(),
  }).strict(),
};

const event = (name, statePath) => ({ event: { name, context: { statePath } } });

export const GatherCapture = createComponentImplementation(GatherCaptureApi, ({ props, context }) => {
  if (props.phase !== 'capture') return null;
  return <button onClick={() => context.dispatchAction(event(GATHER_ACTION_IDS.capture, props.statePath))}>Capture fixture image</button>;
});

export const MaskReview = createComponentImplementation(MaskReviewApi, ({ props, context }) => {
  if (props.phase === 'error') return <p role="alert">{props.error}</p>;
  if (props.phase === 'accepted' && props.result) {
    return (
      <section className="gather-status-panel">
        <h2>Result accepted</h2>
        <p>Area: {props.result.measurements.area.value} {props.result.measurements.area.unit}</p>
        <button onClick={() => context.dispatchAction(event(GATHER_ACTION_IDS.retake, props.statePath))}>Retake</button>
      </section>
    );
  }
  if (props.phase !== 'review-mask' || !props.image || !props.segmentation) return null;
  return (
    <section className="gather-status-panel">
      <div className="mask-preview">
        <img src={props.image.uri} alt="Captured fixture" />
        <img src={props.segmentation.mask.uri} alt="Proposed mask" />
      </div>
      <p>Review the proposed mask before accepting measurements.</p>
      <button onClick={() => context.dispatchAction(event(GATHER_ACTION_IDS.accept, props.statePath))}>Accept mask</button>
      <button onClick={() => context.dispatchAction(event(GATHER_ACTION_IDS.retake, props.statePath))}>Retake</button>
    </section>
  );
});
