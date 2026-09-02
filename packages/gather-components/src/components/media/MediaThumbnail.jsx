import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { mediaPosterUri } from './mediaModel.js';

/**
 * A single media tile: a photo/poster still, a video play badge for video items,
 * and optional select / remove / reorder affordances. Presentation only — it
 * emits intent through callbacks and renders identically on every platform.
 * Tapping the still opens the viewer via `onOpen`.
 */
export function MediaThumbnail({
  entry,
  kind,
  selected = false,
  allowSelect = false,
  allowRemove = false,
  allowReorder = false,
  isFirst = false,
  isLast = false,
  onOpen,
  onToggleSelect,
  onRemove,
  onMovePrev,
  onMoveNext,
  testIDPrefix = 'media-gallery',
}) {
  const theme = useTheme();
  const poster = mediaPosterUri(entry.item);
  const isVideo = kind === 'video';
  const tileTestID = `${testIDPrefix}-item-${entry.index}`;

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          borderRadius: tokens.radii.md,
        },
      ]}
      testID={tileTestID}
    >
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={isVideo ? 'Play video' : 'View photo'}
        onPress={() => onOpen?.(entry)}
        style={styles.stillPress}
        testID={`${tileTestID}-open`}
      >
        {poster ? (
          <Image source={{ uri: poster }} style={styles.still} resizeMode="cover" />
        ) : (
          <View style={[styles.still, styles.stillPlaceholder]}>
            <Text style={styles.placeholderGlyph}>{isVideo ? '🎞️' : '🖼️'}</Text>
          </View>
        )}
        {isVideo ? (
          <View pointerEvents="none" style={styles.playBadge}>
            <Text style={styles.playGlyph}>▶</Text>
          </View>
        ) : null}
      </Pressable>

      {allowSelect ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={selected ? 'Selected' : 'Select'}
          onPress={() => onToggleSelect?.(entry)}
          style={[styles.corner, styles.selectCorner]}
          testID={`${tileTestID}-select`}
        >
          <View
            style={[
              styles.selectDot,
              {
                backgroundColor: selected ? theme.colors.primary : 'rgba(0,0,0,0.35)',
                borderColor: theme.colors.textInverse,
              },
            ]}
          >
            {selected ? <Text style={[styles.selectCheck, { color: theme.colors.textInverse }]}>✓</Text> : null}
          </View>
        </Pressable>
      ) : null}

      {allowRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove"
          onPress={() => onRemove?.(entry)}
          style={[styles.corner, styles.removeCorner]}
          testID={`${tileTestID}-remove`}
        >
          <View style={[styles.removeDot, { backgroundColor: theme.colors.danger }]}>
            <Text style={[styles.removeGlyph, { color: theme.colors.textInverse }]}>✕</Text>
          </View>
        </Pressable>
      ) : null}

      {allowReorder ? (
        <View style={styles.reorderRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move earlier"
            disabled={isFirst}
            onPress={() => onMovePrev?.(entry)}
            style={[styles.reorderBtn, { backgroundColor: 'rgba(0,0,0,0.45)' }, isFirst && styles.reorderDisabled]}
            testID={`${tileTestID}-move-prev`}
          >
            <Text style={styles.reorderGlyph}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move later"
            disabled={isLast}
            onPress={() => onMoveNext?.(entry)}
            style={[styles.reorderBtn, { backgroundColor: 'rgba(0,0,0,0.45)' }, isLast && styles.reorderDisabled]}
            testID={`${tileTestID}-move-next`}
          >
            <Text style={styles.reorderGlyph}>›</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const CORNER = 32;

const styles = StyleSheet.create({
  tile: { position: 'relative', overflow: 'hidden', aspectRatio: 1 },
  stillPress: { flex: 1 },
  still: { width: '100%', height: '100%' },
  stillPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderGlyph: { fontSize: 32 },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 44,
    height: 44,
    marginTop: -22,
    marginLeft: -22,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { color: '#ffffff', fontSize: 18, marginLeft: 3 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, alignItems: 'center', justifyContent: 'center' },
  selectCorner: { top: 2, left: 2 },
  removeCorner: { top: 2, right: 2 },
  selectDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCheck: { fontSize: 14, fontWeight: '700', lineHeight: 16 },
  removeDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  removeGlyph: { fontSize: 13, fontWeight: '700', lineHeight: 15 },
  reorderRow: { position: 'absolute', bottom: 4, left: 4, right: 4, flexDirection: 'row', justifyContent: 'space-between' },
  reorderBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  reorderDisabled: { opacity: 0.35 },
  reorderGlyph: { color: '#ffffff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
});
