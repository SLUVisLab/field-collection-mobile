import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens.js';
import { useTheme } from '../theme/useTheme.js';
import { CameraView } from '../camera/index.js';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { mediaPosterUri } from '../media/mediaModel.js';
import { canCapture, canComplete, captureCountLabel, removeItemAt } from './multiImageModel.js';

/**
 * `MultiImageCapture` — one input control that collects a bounded set of images.
 *
 * A **compound Component**: it composes `CameraView` and `MediaGallery` and owns
 * the interaction between them, but from the outside it behaves like a single
 * field control producing `ImageAsset[]`. Analogous to a multi-file picker or a
 * date-range picker — sophisticated inside, one value outside.
 *
 * **Controlled.** The collection lives with the host, not here: drafts reload
 * mid-instance (`instanceLifecycleService.resume()`), so a researcher who
 * captured three of four photos and left the form must not lose them. Only view
 * state is internal.
 *
 * **It never persists.** `onCapture` receives the plain local capture descriptor
 * and the host materializes the durable `ImageAsset` and appends it — the same
 * seam `CameraView` already uses. Awaiting it drives the busy state, so
 * per-photo progress is visible without this component knowing anything about
 * storage.
 *
 * **No `Flow`.** Switching between camera and gallery is ordinary component
 * state. `Flow` is the A2UI authoring primitive for selecting among *authored*
 * Views; these views are shipped behavior, so there is nothing to author. See
 * docs/components-capabilities-ownership.md §12.
 *
 * The primitives stay independently available: an author who needs a
 * structurally different interaction composes `CameraView` + `MediaGallery` +
 * `Flow` directly rather than configuring this.
 *
 * @param {{
 *   value?: object[],
 *   onCapture?: (capture: object) => Promise<unknown> | unknown,
 *   onChange?: (next: object[]) => void,
 *   onDone?: (items: object[]) => void,
 *   onCancel?: () => void,
 *   minItems?: number,
 *   maxItems?: number | null,
 *   allowRemove?: boolean,
 *   allowReorder?: boolean,
 *   testIDPrefix?: string,
 * }} props
 */
export function MultiImageCapture({
  value = [],
  onCapture,
  onChange,
  onDone,
  onCancel,
  minItems = 0,
  maxItems = null,
  allowRemove = true,
  allowReorder = false,
  testIDPrefix = 'multi-image-capture',
}) {
  const theme = useTheme();
  const [view, setView] = useState('camera');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const items = Array.isArray(value) ? value : [];
  const capturable = canCapture({ items, maxItems });
  const completable = canComplete({ items, minItems });
  const countLabel = captureCountLabel({ items, minItems, maxItems });
  const latest = items.length > 0 ? items[items.length - 1] : null;
  const latestPoster = latest ? mediaPosterUri(latest) : null;
  const limit = Number.isFinite(maxItems) ? Math.floor(maxItems) : null;
  const limitNotice =
    limit === null
      ? null
      : `This field takes ${limit} ${limit === 1 ? 'photo' : 'photos'}. Remove one to add another.`;

  const handleCapture = useCallback(
    async (capture) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        // The host persists and appends; this component stays controlled.
        await onCapture?.(capture);
      } catch (cause) {
        setError(cause instanceof Error && cause.message ? cause.message : 'Could not save that photo.');
      } finally {
        setBusy(false);
      }
    },
    [busy, onCapture]
  );

  if (view === 'gallery') {
    return (
      <MediaGallery
        items={items}
        allowRemove={allowRemove}
        allowReorder={allowReorder}
        onRemove={(_item, index) => onChange?.(removeItemAt(items, index))}
        onReorder={(next) => onChange?.(next)}
        onBack={() => setView('camera')}
        // Done appears only once the minimum is met; the camera's count
        // accessory is what communicates progress before then.
        onDone={completable ? () => onDone?.(items) : undefined}
        backLabel="Back to camera"
        doneLabel="Done"
        emptyLabel="No photos captured yet."
        testIDPrefix={`${testIDPrefix}-gallery`}
      />
    );
  }

  return (
    <View style={styles.container} testID={testIDPrefix}>
      <CameraView
        canCapture={capturable}
        notice={capturable ? null : limitNotice}
        onCapture={handleCapture}
        onCancel={onCancel}
        testIDPrefix={`${testIDPrefix}-camera`}
        leading={
          latest ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Review ${items.length} captured ${items.length === 1 ? 'photo' : 'photos'}`}
              onPress={() => setView('gallery')}
              testID={`${testIDPrefix}-open-gallery`}
              style={[styles.thumbnail, { borderColor: theme.colors.border, borderRadius: tokens.radii.sm }]}
            >
              {latestPoster ? (
                <Image source={{ uri: latestPoster }} style={styles.thumbnailFill} resizeMode="cover" />
              ) : null}
            </Pressable>
          ) : null
        }
        trailing={
          countLabel ? (
            <Text
              accessibilityLabel={`${items.length} captured`}
              // `textInverse` is for text over an inverted surface; the count
              // sits in the shutter row on the ordinary one, where inverse
              // resolves to near-black in the dark theme — invisible.
              style={[styles.count, { color: theme.colors.text }]}
              testID={`${testIDPrefix}-count`}
            >
              {countLabel}
            </Text>
          ) : null
        }
      />
      {error ? (
        <Text accessibilityRole="alert" style={[styles.message, { color: theme.colors.danger }]}>
          {error}
        </Text>
      ) : null}
      {busy ? (
        <Text style={[styles.message, { color: theme.colors.textMuted }]} testID={`${testIDPrefix}-busy`}>
          Saving photo…
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.spacing.sm },
  thumbnail: { borderWidth: 1, height: 48, overflow: 'hidden', width: 48 },
  thumbnailFill: { height: '100%', width: '100%' },
  count: { fontSize: tokens.typography.body, fontWeight: '700' },
  message: { fontSize: tokens.typography.helper, textAlign: 'center' },
});
