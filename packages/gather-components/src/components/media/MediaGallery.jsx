import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { Button } from '../actions/Button.jsx';
import { Helper } from '../primitives.jsx';
import { MediaThumbnail } from './MediaThumbnail.jsx';
import { MediaViewer } from './MediaViewer.jsx';
import { mediaKind, moveItem, normalizeMediaItems, selectionKeySet } from './mediaModel.js';

/**
 * `MediaGallery` — a Composer-visible, presentation-only surface over a collection
 * of durable media assets (photos and videos). It shows a thumbnail grid with a
 * built-in viewer modal (photos display, videos play), plus optional select /
 * remove / reorder affordances and Back / Done actions.
 *
 * It emits intent through callbacks and owns no acquisition, persistence, ODK
 * advancement, or Tool orchestration. Items are duck-typed for display only
 * (`uri`, optional `width`/`height`/`mimeType`/`durationMs`/`posterUri`), so it
 * does not depend on the typed asset contracts.
 */
export function MediaGallery({
  items = [],
  allowSelect = false,
  allowRemove = false,
  allowReorder = false,
  selectedItem = null,
  selectedItems = null,
  onSelect,
  onRemove,
  onReorder,
  onBack,
  onDone,
  backLabel = 'Back',
  doneLabel = 'Done',
  emptyLabel = 'No media captured yet.',
  columns = 3,
  testIDPrefix = 'media-gallery',
}) {
  const theme = useTheme();
  const [viewerEntry, setViewerEntry] = useState(null);

  const entries = normalizeMediaItems(items);
  const selectedKeys = selectionKeySet({ selectedItem, selectedItems });
  const columnCount = Math.max(1, Math.floor(columns));
  const tileBasis = `${100 / columnCount}%`;

  const emitReorder = (from, to) => {
    if (from === to) return;
    const next = moveItem(items, from, to);
    if (next !== items) onReorder?.(next, { from, to });
  };

  return (
    <View style={styles.container} testID={testIDPrefix}>
      {entries.length === 0 ? (
        <View style={[styles.empty, { borderColor: theme.colors.border, borderRadius: tokens.radii.md }]} testID={`${testIDPrefix}-empty`}>
          <Helper>{emptyLabel}</Helper>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} testID={`${testIDPrefix}-grid`}>
          {entries.map((entry) => (
            <View key={entry.key} style={[styles.cell, { flexBasis: tileBasis, maxWidth: tileBasis }]}>
              <MediaThumbnail
                entry={entry}
                kind={mediaKind(entry.item)}
                selected={selectedKeys.has(entry.key)}
                allowSelect={allowSelect}
                allowRemove={allowRemove}
                allowReorder={allowReorder}
                isFirst={entry.index === 0}
                isLast={entry.index === entries.length - 1}
                onOpen={setViewerEntry}
                onToggleSelect={(picked) => onSelect?.(picked.item, picked.index)}
                onRemove={(picked) => onRemove?.(picked.item, picked.index)}
                onMovePrev={(picked) => emitReorder(picked.index, picked.index - 1)}
                onMoveNext={(picked) => emitReorder(picked.index, picked.index + 1)}
                testIDPrefix={testIDPrefix}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {onBack || onDone ? (
        <View style={styles.actions}>
          {onBack ? (
            <Button label={backLabel} variant="secondary" onPress={onBack} testID={`${testIDPrefix}-back`} style={styles.action} />
          ) : null}
          {onDone ? (
            <Button label={doneLabel} onPress={onDone} testID={`${testIDPrefix}-done`} style={styles.action} />
          ) : null}
        </View>
      ) : null}

      <MediaViewer entry={viewerEntry} onClose={() => setViewerEntry(null)} testIDPrefix={testIDPrefix} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.spacing.md, width: '100%' },
  empty: { borderWidth: StyleSheet.hairlineWidth, padding: tokens.spacing.lg, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { padding: tokens.spacing.xs / 2 },
  actions: { flexDirection: 'row', gap: tokens.spacing.sm, justifyContent: 'flex-end' },
  action: { minWidth: 120 },
});
