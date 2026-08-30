import { Image, StyleSheet, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { ActionButton } from '../actions/ActionButton.jsx';
import { Panel, SectionCopy } from '../primitives.jsx';

export function MaskReview({ image, segmentation, busy = false, onAccept, onRetake }) {
  const aspectRatio = image?.width && image?.height ? image.width / image.height : 1;
  return (
    <Panel>
      <View style={[styles.media, { aspectRatio }]}>
        <Image source={{ uri: image.uri }} style={styles.fill} resizeMode="contain" />
        <Image source={{ uri: segmentation.mask.uri }} style={[styles.fill, styles.mask]} resizeMode="contain" />
      </View>
      <SectionCopy
        title="Review segmentation"
        body="The overlay is the proposed specimen mask. Confirm that it follows the specimen edge."
      />
      <View style={styles.actionRow}>
        <ActionButton label="Accept mask" onPress={onAccept} disabled={busy} style={styles.flexAction} testID="segment-measure-accept-mask" />
        <ActionButton label="Retake" variant="secondary" onPress={onRetake} disabled={busy} style={styles.flexAction} testID="segment-measure-retake" />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  media: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: tokens.radii.md,
    backgroundColor: '#1f2328',
  },
  fill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  mask: {
    opacity: 0.45,
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  flexAction: {
    flex: 1,
  },
});
