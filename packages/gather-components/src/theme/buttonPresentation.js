import { tokens } from './tokens.js';

export const resolveButtonVariant = ({ variant, tone } = {}) => {
  if (variant === 'secondary' || variant === 'danger' || variant === 'primary') return variant;
  return tone === 'danger' ? 'danger' : 'primary';
};

export const buttonAppearance = (theme, variant, pressed = false) => {
  const colors = theme.colors;
  if (variant === 'danger') {
    return {
      backgroundColor: pressed ? colors.dangerPressed : colors.danger,
      color: colors.onDanger,
    };
  }
  if (variant === 'secondary') {
    return {
      backgroundColor: pressed ? colors.secondaryPressed : colors.secondary,
      color: colors.onSecondary,
    };
  }
  return {
    backgroundColor: pressed ? colors.primaryPressed : colors.primary,
    color: colors.onPrimary,
  };
};

export const buttonHeightForVariant = (variant) =>
  variant === 'primary' ? tokens.interaction.primaryActionHeight : tokens.interaction.preferredTouchTarget;
