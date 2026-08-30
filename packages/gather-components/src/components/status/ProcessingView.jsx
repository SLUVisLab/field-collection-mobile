import { Image, StyleSheet, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { Helper, Panel } from '../primitives.jsx';

export function ProcessingView({ image, phase }) {
  const aspectRatio = image?.width && image?.height ? image.width / image.height : 3 / 4;
  const label = phase === 'measuring' ? 'Calculating measurements…' : 'Processing image…';
  return (
    <Panel>
      <View style={[styles.media, { aspectRatio }]}>
        <Image source={{ uri: image.uri }} style={styles.fill} resizeMode="contain" />
      </View>
      <Helper>{label}</Helper>
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
});
