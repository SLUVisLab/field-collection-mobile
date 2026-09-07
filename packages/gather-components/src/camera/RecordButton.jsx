import { StyleSheet, Text, View, Pressable } from 'react-native';

import { tokens } from '../theme/tokens.js';
import { useTheme } from '../theme/useTheme.js';

const two = (n) => String(n).padStart(2, '0');
const formatElapsed = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${two(Math.floor(total / 60))}:${two(total % 60)}`;
};

/**
 * Shared record control for `VideoView` (native + web): a tappable record/stop
 * affordance plus an elapsed-time readout. Presentation only — recording
 * mechanics live in the platform seams.
 */
export function RecordButton({ recording = false, elapsedMs = 0, disabled = false, onToggle, testIDPrefix = 'video' }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onToggle}
        testID={`${testIDPrefix}-record`}
        style={({ pressed }) => [styles.outer, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
      >
        <View style={recording ? styles.stopInner : [styles.recordInner, { backgroundColor: theme.colors.danger }]} />
      </Pressable>
      <Text style={[styles.timer, { color: theme.colors.text }]}>{formatElapsed(elapsedMs)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: tokens.spacing.xs },
  outer: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#444444',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: { width: 58, height: 58, borderRadius: 29 },
  stopInner: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#d64545' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  timer: { fontVariant: ['tabular-nums'], fontSize: tokens.typography.helper },
});
