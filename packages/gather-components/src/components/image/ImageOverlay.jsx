import { Image, StyleSheet, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';

export function ImageOverlay({ image, overlay = null, overlayOpacity = 0.45 }) {
  if (!image?.uri) return null;
  const aspectRatio = image?.width && image?.height ? image.width / image.height : 1;
  const overlayUri = overlay?.uri ?? null;
  return (
    <View style={[styles.media, { aspectRatio }]}>
      <Image source={{ uri: image.uri }} style={styles.fill} resizeMode="contain" />
      {overlayUri ? <Image source={{ uri: overlayUri }} style={[styles.fill, { opacity: overlayOpacity }]} resizeMode="contain" /> : null}
    </View>
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
