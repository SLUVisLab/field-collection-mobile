import { StyleSheet, Text, TextInput } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

const textValue = (value) => {
  if (Array.isArray(value)) return value.map(String).join(' ');
  return value == null ? '' : String(value);
};

export function TextField({
  value,
  onChange,
  disabled = false,
  error = null,
  keyboardType = 'default',
  testID,
}) {
  const defaultValue = textValue(value);
  const theme = useTheme();
  return (
    <>
      <TextInput
        accessibilityState={{ disabled }}
        key={defaultValue}
        defaultValue={defaultValue}
        editable={!disabled}
        keyboardType={keyboardType}
        onEndEditing={(event) => void onChange(event.nativeEvent.text)}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
            borderRadius: tokens.radii.sm,
            color: theme.colors.text,
            fontSize: tokens.typography.body,
            minHeight: tokens.interaction.preferredTouchTarget,
            paddingHorizontal: tokens.spacing.md,
          },
          error && { borderColor: theme.colors.danger },
          disabled && {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.disabled,
          },
        ]}
        testID={testID}
      />
      {error ? (
        <Text style={[styles.invalid, { color: theme.colors.danger, fontSize: tokens.typography.helper }]}>
          {error}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    paddingVertical: 10,
  },
  invalid: {},
});
