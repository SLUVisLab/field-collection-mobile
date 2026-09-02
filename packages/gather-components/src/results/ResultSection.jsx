import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens.js';
import { useTheme } from '../theme/useTheme.js';

export function ResultSection({ title, children }) {
  const theme = useTheme();
  return (
    <View style={[styles.resultSection, { borderTopColor: theme.colors.border }]}>
      <Text style={[styles.resultSectionTitle, { color: theme.colors.text }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

export function ResultRow({ label, value }) {
  const theme = useTheme();
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultRowLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.resultRowValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  resultSection: {
    gap: tokens.spacing.xs,
    borderTopWidth: 1,
    paddingTop: tokens.spacing.sm,
  },
  resultSectionTitle: {
    fontSize: tokens.typography.helper,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
  },
  resultRowLabel: {
    fontSize: tokens.typography.helper,
  },
  resultRowValue: {
    fontSize: tokens.typography.helper,
    fontWeight: '700',
    textAlign: 'right',
  },
});
