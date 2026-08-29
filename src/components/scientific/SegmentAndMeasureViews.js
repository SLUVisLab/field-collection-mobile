import { Image, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../NavButton.js';
import { CameraCapture } from '../camera/CameraCapture.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function SegmentAndMeasureCapture({ onCapture, onCancel, testIDPrefix }) {
  return <CameraCapture onCaptured={onCapture} onCancel={onCancel} testIDPrefix={testIDPrefix} />;
}

export function MaskReview({ image, segmentation, busy, onAccept, onRetake }) {
  const theme = useTheme();
  const aspectRatio = image.width && image.height ? image.width / image.height : 1;
  return (
    <View style={styles.review}>
      <View style={[styles.overlay, { aspectRatio }]}>
        <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" />
        <Image source={{ uri: segmentation.mask.uri }} style={[styles.preview, styles.mask]} resizeMode="contain" />
      </View>
      <Text style={{ color: theme.colors.text }}>Review the proposed mask before accepting measurements.</Text>
      <ActionButton label="Accept mask" onPress={onAccept} disabled={busy} testID="segment-measure-accept-mask" />
      <ActionButton label="Retake" onPress={onRetake} variant="secondary" disabled={busy} testID="segment-measure-retake" />
    </View>
  );
}

export function MeasurementReview({ measurements }) {
  const theme = useTheme();
  const { area, perimeter, boundingBox, centroid, color, sharpness } = measurements;
  return (
    <View style={styles.review}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>Measurements (pixel-space)</Text>
      <Text style={{ color: theme.colors.textMuted }}>Area: {area.value} {area.unit}</Text>
      <Text style={{ color: theme.colors.textMuted }}>Perimeter: {perimeter.value.toFixed(2)} {perimeter.unit}</Text>
      <Text style={{ color: theme.colors.textMuted }}>Bounds: {boundingBox.width} × {boundingBox.height} {boundingBox.unit}</Text>
      <Text style={{ color: theme.colors.textMuted }}>Centroid: ({centroid.x.toFixed(2)}, {centroid.y.toFixed(2)}) {centroid.unit}</Text>
      <Text style={{ color: theme.colors.textMuted }}>Mean sRGB: {color.channels.red.toFixed(1)}, {color.channels.green.toFixed(1)}, {color.channels.blue.toFixed(1)}</Text>
      <Text style={{ color: theme.colors.textMuted }}>Sharpness ({sharpness.metric}): {sharpness.score.toFixed(2)}</Text>
    </View>
  );
}

export function ClassificationReview({ classification }) {
  const theme = useTheme();
  if (!classification) return null;
  return (
    <View style={styles.review}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>Generic ImageNet demonstration</Text>
      <Text style={{ color: theme.colors.textMuted }}>This is not botanical or taxonomic identification.</Text>
      {classification.ranked.slice(0, 3).map((item) => (
        <Text key={item.label} style={{ color: theme.colors.textMuted }}>
          {item.label} ({(item.score * 100).toFixed(1)}%)
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  review: { gap: tokens.spacing.sm },
  heading: { fontSize: tokens.typography.body, fontWeight: '700' },
  overlay: { width: '100%', position: 'relative' },
  preview: { width: '100%', height: '100%', resizeMode: 'contain', position: 'absolute' },
  mask: { opacity: 0.45, tintColor: '#00ff66' },
});
