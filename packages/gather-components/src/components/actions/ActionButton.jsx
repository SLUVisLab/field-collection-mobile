import { Pressable, StyleSheet, Text } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import {
  buttonAppearance,
  buttonHeightForVariant,
  resolveButtonVariant,
} from '../../theme/buttonPresentation.js';

/**
 * Field-sized action button shared by mobile and web renderer Components.
 * Router-free by design so it carries no native-only navigation dependency.
 */
export function ActionButton({
  onPress,
  label,
  tone = 'default',
  variant,
  testID,
  disabled = false,
  style,
}) {
  const theme = useTheme();
  const resolvedVariant = resolveButtonVariant({ variant, tone });

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => {
        const appearance = buttonAppearance(theme, resolvedVariant, pressed && !disabled);
        return [
          styles.button,
          style,
          {
            backgroundColor: appearance.backgroundColor,
            borderRadius: tokens.radii.md,
            minHeight: buttonHeightForVariant(resolvedVariant),
          },
          disabled && styles.disabled,
        ];
      }}
      testID={testID}
    >
      {({ pressed }) => {
        const appearance = buttonAppearance(theme, resolvedVariant, pressed && !disabled);
        return (
          <Text style={[styles.label, { color: appearance.color, fontSize: tokens.typography.body }]}>
            {label}
          </Text>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: {
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: { opacity: 0.55 },
});
