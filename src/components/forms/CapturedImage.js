import { Image, StyleSheet, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

const DEFAULT_ASPECT_RATIO = 3 / 4;

/**
 * Shows a captured still while the researcher decides whether to attach it.
 *
 * App-only presentation for the XForms image field — acquisition itself is
 * package-owned (`CameraView` in `gather-components`). It renders the capture's
 * own dimensions so a landscape photo is not cropped to a portrait frame.
 */
export function CapturedImage({ uri, width, height }) {
  const theme = useTheme();
  if (typeof uri !== 'string' || uri.length === 0) return null;
  const aspectRatio = width > 0 && height > 0 ? width / height : DEFAULT_ASPECT_RATIO;
  return (
    <View
      style={[
        styles.frame,
        { aspectRatio, backgroundColor: theme.colors.surface, borderRadius: tokens.radii.md },
      ]}
    >
      <Image accessibilityLabel="Captured image preview" source={{ uri }} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', width: '100%' },
  image: { flex: 1, resizeMode: 'contain' },
});
