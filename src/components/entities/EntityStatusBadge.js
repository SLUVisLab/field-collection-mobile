import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/useTheme.js';

const label = { pending: 'Pending', draft: 'Draft', complete: 'Complete', sent: 'Synced' };

export function EntityStatusBadge({ state }) {
  const theme = useTheme();
  const color = state === 'sent' || state === 'complete' ? theme.colors.success : state === 'draft' ? theme.colors.primary : theme.colors.textMuted;
  return <Text style={[styles.text, { color }]}>{label[state] ?? state}</Text>;
}

const styles = StyleSheet.create({ text: { fontWeight: '700' } });
