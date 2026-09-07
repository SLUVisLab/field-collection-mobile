import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { mediaKind } from './mediaModel.js';
import { MediaSurface } from './MediaSurface';

/**
 * Full-screen viewer modal that displays a photo or plays a video. The modal
 * chrome (backdrop + close) is shared cross-platform; only the media surface is
 * platform-seamed. Presentation only — it renders whichever item the gallery hands
 * it and reports close through `onClose`.
 */
export function MediaViewer({ entry = null, onClose, testIDPrefix = 'media-gallery' }) {
  const theme = useTheme();
  const visible = entry != null;
  const item = entry?.item ?? null;
  const uri = typeof item?.uri === 'string' && item.uri.length > 0 ? item.uri : null;
  const kind = item ? mediaKind(item) : 'photo';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} testID={`${testIDPrefix}-viewer`}>
      <View style={styles.backdrop}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.colors.surface }]}
            testID={`${testIDPrefix}-viewer-close`}
          >
            <Text style={[styles.closeGlyph, { color: theme.colors.text }]}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.stage}>
          {uri ? (
            <MediaSurface kind={kind} uri={uri} />
          ) : (
            <Text style={styles.unavailable}>This item has no media to display.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', padding: tokens.spacing.md },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 18, fontWeight: '700' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.md },
  unavailable: { color: '#ffffff', fontSize: tokens.typography.body },
});
