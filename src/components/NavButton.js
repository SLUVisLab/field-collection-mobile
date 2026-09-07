import { Pressable, StyleSheet, Text } from 'react-native';
import { Link } from 'react-router-native';

import {
  buttonAppearance,
  buttonHeightForVariant,
  resolveButtonVariant,
} from './buttonPresentation.js';
import { tokens } from '../theme/tokens.js';
import { useTheme } from '../theme/useTheme.js';

/**
 * Navigation and action controls keep their distinct behavior, while sharing
 * the same field-sized button presentation.
 */
export function NavButton({ to, label, testID, variant = 'secondary' }) {
  const theme = useTheme();
  const resolvedVariant = resolveButtonVariant({ variant });
  const appearance = buttonAppearance(theme, resolvedVariant);
  const pressedAppearance = buttonAppearance(theme, resolvedVariant, true);

  return (
    <Link
      accessibilityLabel={label}
      accessibilityRole="link"
      to={to}
      underlayColor={pressedAppearance.backgroundColor}
      style={[
        styles.button,
        {
          backgroundColor: appearance.backgroundColor,
          borderRadius: tokens.radii.md,
          minHeight: buttonHeightForVariant(resolvedVariant),
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.label, { color: appearance.color, fontSize: tokens.typography.body }]}>
        {label}
      </Text>
    </Link>
  );
}

/** An action button that runs a handler (e.g. switch/clear active project). */
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
