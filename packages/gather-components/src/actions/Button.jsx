import { Pressable, StyleSheet, Text } from 'react-native';

import { tokens } from '../theme/tokens.js';
import { useTheme } from '../theme/useTheme.js';
import { buttonAppearance, buttonHeightForVariant } from '../theme/buttonPresentation.js';

const normalizeVariant = (variant) => {
  if (variant === 'primary' || variant === 'secondary' || variant === 'danger' || variant === 'borderless') {
    return variant;
  }
  return 'primary';
};

export function Button({
  onPress,
  label,
  children = null,
  variant = 'primary',
  testID,
  disabled = false,
  style,
}) {
  const theme = useTheme();
  const resolvedVariant = normalizeVariant(variant);
  const isBorderless = resolvedVariant === 'borderless';

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
          isBorderless
            ? styles.borderlessButton
            : {
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
        if (children) return children;
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
  borderlessButton: {
    minHeight: tokens.interaction.minimumTouchTarget,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  label: {
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: { opacity: 0.55 },
});
