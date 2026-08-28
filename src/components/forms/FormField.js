import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function FormField({ label, hint = null, required = false, indent = 0, onLayout, children }) {
  const theme = useTheme();

  return (
    <View onLayout={onLayout} style={[styles.field, { gap: tokens.spacing.sm, marginLeft: indent, paddingVertical: tokens.spacing.sm + 2 }]}>
      <Text style={[styles.label, { color: theme.colors.text, fontSize: tokens.typography.label }]}>
        {label}
        {required ? ' *' : ''}
      </Text>
      {hint ? (
        <Text style={[styles.hint, { color: theme.colors.textMuted, fontSize: tokens.typography.helper, lineHeight: tokens.typography.helperLineHeight }]}>
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {},
  label: { fontWeight: '600' },
  hint: {},
});
