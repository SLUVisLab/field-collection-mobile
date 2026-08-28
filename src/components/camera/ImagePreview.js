import { Image, StyleSheet, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function ImagePreview({ uri }) {
  const theme = useTheme();
  if (typeof uri !== 'string' || uri.length === 0) return null;
  return (
    <View style={[styles.frame, { backgroundColor: theme.colors.surface, borderRadius: tokens.radii.md }]}>
      <Image accessibilityLabel="Captured image preview" source={{ uri }} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 3 / 4,
    overflow: 'hidden',
    width: '100%',
  },
  image: { flex: 1, resizeMode: 'cover' },
});
