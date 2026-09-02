import { StyleSheet, View } from 'react-native';

import { ActionButton } from '../NavButton.js';
import { tokens } from '../../theme/tokens.js';

/**
 * Confirm/discard actions for a captured still.
 *
 * Despite its former name (`CameraControls`) this is not camera control — the
 * camera owns its own shutter and controls inside `CameraView`. These are the
 * workflow actions that follow a capture, which belong outside the camera.
 */
export function CaptureActions({
  confirmLabel = 'Use this photo',
  cancelLabel = 'Retake',
  disabled = false,
  onConfirm,
  onCancel,
  testIDPrefix = 'camera',
}) {
  return (
    <View style={styles.actions}>
      <ActionButton
        disabled={disabled}
        label={confirmLabel}
        onPress={() => void onConfirm?.()}
        style={styles.action}
        testID={`${testIDPrefix}-capture`}
      />
      {onCancel ? (
        <ActionButton
          disabled={disabled}
          label={cancelLabel}
          onPress={onCancel}
          style={styles.action}
          testID={`${testIDPrefix}-cancel`}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  action: { alignSelf: 'flex-start' },
});
