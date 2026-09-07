import { Pressable, StyleSheet, Text } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function ChoiceList({
  choices,
  selectedValues,
  multiple = false,
  disabled = false,
  onChange,
  testIDForChoice,
}) {
  const theme = useTheme();

  return choices.map((choice) => {
    const choiceValue = String(choice.value ?? '');
    const selected = selectedValues.includes(choiceValue);
    return (
      <Pressable
        key={choiceValue}
        accessibilityRole={multiple ? 'checkbox' : 'radio'}
        accessibilityState={{ selected, checked: selected, disabled }}
        disabled={disabled}
        onPress={() => {
          const next = multiple
            ? selected
              ? selectedValues.filter((value) => value !== choiceValue)
              : [...selectedValues, choiceValue]
            : choiceValue;
          void onChange(next);
        }}
        style={({ pressed }) => [
          styles.choice,
          {
            backgroundColor: selected ? theme.colors.selection : theme.colors.surface,
            borderColor: selected ? theme.colors.primary : theme.colors.border,
            borderRadius: tokens.radii.sm,
            minHeight: tokens.interaction.preferredTouchTarget,
            paddingHorizontal: tokens.spacing.md,
          },
          pressed && !disabled && styles.choicePressed,
          disabled && styles.choiceDisabled,
        ]}
        testID={testIDForChoice?.(choiceValue)}
      >
        <Text style={[styles.choiceMark, { color: selected ? theme.colors.primary : theme.colors.textMuted }]}>
          {selected ? '●' : '○'}
        </Text>
        <Text style={[styles.choiceText, { color: theme.colors.text, fontSize: tokens.typography.body }]}>
          {String(choice.label ?? choice.value ?? '')}
        </Text>
      </Pressable>
    );
  });
}

const styles = StyleSheet.create({
  choice: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  choicePressed: { opacity: 0.82 },
  choiceDisabled: { opacity: 0.55 },
  choiceMark: { fontSize: 15 },
  choiceText: { flex: 1 },
});
