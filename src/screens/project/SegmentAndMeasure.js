import { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-native';

import { ActionButton } from '../../components/NavButton.js';
import { Screen } from '../../components/Screen.js';
import { useGather } from '../../context/GatherContext.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { createSegmentAndMeasureResult } from '../../scientific/workflows/segmentAndMeasure.js';
import {
  ClassificationReview,
  MaskReview,
  MeasurementReview,
  SegmentAndMeasureCapture,
} from '../../components/scientific/SegmentAndMeasureViews.js';

export function SegmentAndMeasure() {
  const navigate = useNavigate();
  const { actions } = useGather();
  const theme = useTheme();
  const [image, setImage] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [segmentation, setSegmentation] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const capture = useCallback(async (captureResult) => {
    setCaptured(captureResult);
    setBusy(true);
    setError(null);
    try {
      const persisted = await actions.persistScientificCapture(captureResult);
      setImage(persisted);
      const nextSegmentation = await actions.segmentScientificImage({ image: persisted });
      setSegmentation(nextSegmentation);
    } catch (cause) {
      setError(cause?.message ?? 'Could not segment this image.');
    } finally {
      setBusy(false);
    }
  }, [actions]);

  const acceptMask = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [maskMeasurements, imageMeasurements, classification] = await Promise.all([
        actions.measureScientificMask({ mask: segmentation.mask }),
        actions.measureScientificImage({ image, mask: segmentation.mask }),
        actions.classifyScientificImage({ image }),
      ]);
      setResult(createSegmentAndMeasureResult({
        image,
        segmentation,
        maskMeasurements,
        imageMeasurements,
        classification,
      }));
    } catch (cause) {
      setError(cause?.message ?? 'Could not calculate measurements.');
    } finally {
      setBusy(false);
    }
  }, [actions, image, segmentation]);

  const retake = useCallback(() => {
    setImage(null);
    setCaptured(null);
    setSegmentation(null);
    setResult(null);
    setError(null);
  }, []);

  return (
    <Screen screenId="segment-measure" title="Segment & Measure" subtitle="Generic image measurements">
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
      {!captured ? <SegmentAndMeasureCapture onCapture={capture} onCancel={() => navigate(-1)} testIDPrefix="segment-measure-camera" /> : null}
      {captured && !segmentation && !result ? (
        <View style={styles.review}>
          <Image
            source={{ uri: captured.uri }}
            style={[styles.capturedPreview, captured.width && captured.height ? { aspectRatio: captured.width / captured.height } : null]}
            resizeMode="contain"
          />
          {busy ? (
            <Text style={{ color: theme.colors.textMuted }}>Processing image…</Text>
          ) : (
            <ActionButton label="Retake" onPress={retake} variant="secondary" testID="segment-measure-retake-error" />
          )}
        </View>
      ) : null}
      {segmentation && !result ? (
        <MaskReview
          image={image}
          segmentation={segmentation}
          busy={busy}
          onAccept={() => void acceptMask()}
          onRetake={retake}
        />
      ) : null}
      {result ? (
        <View style={styles.review}>
          <Text style={{ color: theme.colors.text }}>Mask accepted. Measurements are in pixel units.</Text>
          <MeasurementReview measurements={result.measurements} />
          <ClassificationReview classification={result.classification} />
          <ActionButton label="Accept result" onPress={() => navigate(-1)} testID="segment-measure-accept-result" />
          <ActionButton label="Retake" onPress={retake} variant="secondary" testID="segment-measure-retake-result" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: tokens.typography.body },
  review: { gap: tokens.spacing.md },
  capturedPreview: { width: '100%', minHeight: 240 },
});
