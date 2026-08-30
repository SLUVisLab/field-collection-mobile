import { Image, Text, View } from 'react-native';
import { CommonSchemas } from '@a2ui/web_core/v0_9/common-schemas';
import { z } from 'zod';

import { ActionButton } from '../../components/NavButton.js';
import { MaskReview, MeasurementReview, ClassificationReview, SegmentAndMeasureCapture } from '../../components/scientific/SegmentAndMeasureViews.js';
import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS } from 'gather-catalog';
import { useTheme } from '../../theme/useTheme.js';

import { bindInstrumentComponent } from './InstrumentSurface.js';

export const gatherCaptureApi = {
  name: GATHER_COMPONENT_IDS.capture,
  schema: z.object({ phase: CommonSchemas.DynamicString, statePath: z.string() }).strict(),
};

export const maskReviewApi = {
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

const action = (name, statePath) => ({ event: { name, context: { statePath } } });

function ProcessingReview({ image, phase }) {
  const theme = useTheme();
  if (!image || !['persisting-capture', 'segmenting', 'measuring', 'classifying'].includes(phase)) return null;
  return (
    <View>
      <Image source={{ uri: image.uri }} style={{ width: '100%', minHeight: 240, aspectRatio: image.width / image.height }} resizeMode="contain" />
      <Text style={{ color: theme.colors.text }}>{phase === 'measuring' ? 'Calculating measurements…' : 'Processing image…'}</Text>
    </View>
  );
}

export const segmentAndMeasureImplementations = {
  [GATHER_COMPONENT_IDS.capture]: {
    component: bindInstrumentComponent(gatherCaptureApi.schema, ({ phase, statePath, context }) => {
      if (phase !== 'capture') return null;
      return <SegmentAndMeasureCapture onCapture={(capture) => context.dispatchAction({ event: { name: GATHER_ACTION_IDS.capture, context: { statePath, capture } } })} />;
    }),
  },
  [GATHER_COMPONENT_IDS.maskReview]: {
    component: bindInstrumentComponent(maskReviewApi.schema, ({ phase, image, segmentation, classification, result, error, statePath, context }) => {
      const theme = useTheme();
      if (phase === 'error') return <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text>;
      if (image && ['persisting-capture', 'segmenting', 'measuring', 'classifying'].includes(phase)) {
        return <ProcessingReview image={image} phase={phase} />;
      }
      if (phase === 'review-mask' && image && segmentation) {
        return <MaskReview image={image} segmentation={segmentation} onAccept={() => context.dispatchAction(action(GATHER_ACTION_IDS.accept, statePath))} onRetake={() => context.dispatchAction(action(GATHER_ACTION_IDS.retake, statePath))} />;
      }
      if (phase === 'accepted' && result) {
        return (
          <View>
            <Text style={{ color: theme.colors.text }}>Mask accepted. Measurements are in pixel units.</Text>
            <MeasurementReview measurements={result.measurements} />
            <ClassificationReview classification={classification} />
            <ActionButton label="Retake" variant="secondary" onPress={() => context.dispatchAction(action(GATHER_ACTION_IDS.retake, statePath))} />
          </View>
        );
      }
      return null;
    }),
  },
};
