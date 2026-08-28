import { StyleSheet, View } from 'react-native';

import { ActionButton } from '../NavButton.js';
import { tokens } from '../../theme/tokens.js';

export function CameraControls({
  captureLabel = 'Take photo',
  cancelLabel = 'Cancel',
  captureDisabled = false,
  onCapture,
  onCancel,
  testIDPrefix = 'camera',
}) {
  return (
    <View style={styles.actions}>
      <ActionButton
        disabled={captureDisabled}
        label={captureLabel}
        onPress={() => void onCapture?.()}
        style={styles.action}
        testID={`${testIDPrefix}-capture`}
      />
      {onCancel ? (
        <ActionButton
          disabled={captureDisabled}
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
