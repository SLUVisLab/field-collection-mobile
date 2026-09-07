import { StyleSheet, Text } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

const textValue = (value) => {
  if (Array.isArray(value)) return value.map(String).join(' ');
  return value == null ? '' : String(value);
};

export function ReadonlyValue({ value, emptyValue = '—' }) {
  const theme = useTheme();
  return (
    <Text style={[styles.value, { color: theme.colors.textMuted, fontSize: tokens.typography.body }]}>
      {textValue(value) || emptyValue}
    </Text>
  );
}

const styles = StyleSheet.create({
  value: { paddingVertical: 6 },
});
