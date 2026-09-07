import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_COLOR_KEYS,
  darkTheme,
  lightTheme,
  resolveTheme,
} from '../../src/theme/themes.js';
import { tokens } from '../../src/theme/tokens.js';
import { palette } from '../../src/theme/palette.js';
import { GATHER_LAYOUT_TOKENS } from 'gather-components/tokens';
import { GATHER_PALETTE } from 'gather-components/palette';
import {
  buttonAppearance,
  buttonHeightForVariant,
  resolveButtonVariant,
} from '../../src/components/buttonPresentation.js';

const relativeLuminance = (hex) => {
  assert.match(hex, /^#[\da-f]{6}$/i, `Expected an opaque six-digit color, received ${hex}`);
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (foreground, background) => {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (first, second) => second - first
  );
  return (lighter + 0.05) / (darker + 0.05);
};

test('useTheme resolution helper follows dark mode and safely falls back to light', () => {
  assert.equal(resolveTheme('light'), lightTheme);
  assert.equal(resolveTheme('dark'), darkTheme);
  assert.equal(resolveTheme(null), lightTheme);
  assert.equal(resolveTheme('unknown'), lightTheme);
});

test('semantic themes expose the same required color keys', () => {
  const lightKeys = Object.keys(lightTheme.colors).sort();
  const darkKeys = Object.keys(darkTheme.colors).sort();

  assert.deepEqual(lightKeys, darkKeys);
  assert.deepEqual(
    [...REQUIRED_COLOR_KEYS].sort(),
    REQUIRED_COLOR_KEYS.filter((key) => lightKeys.includes(key)).sort()
  );
});

test('field interaction tokens meet Gather target minimums', () => {
  assert.ok(tokens.interaction.minimumTouchTarget >= 48);
  assert.ok(tokens.interaction.preferredTouchTarget >= 52);
  assert.ok(tokens.interaction.primaryActionHeight >= 56);
});

test('mobile theme primitives consume the shared components theme contract', () => {
  assert.equal(tokens, GATHER_LAYOUT_TOKENS);
  assert.equal(palette, GATHER_PALETTE);
});

test('key theme contrast pairs meet WCAG AA normal-text contrast', () => {
  for (const theme of [lightTheme, darkTheme]) {
    for (const [foreground, background] of [
      ['text', 'background'],
      ['text', 'surface'],
      ['onPrimary', 'primary'],
      ['onDanger', 'danger'],
    ]) {
      assert.ok(
        contrastRatio(theme.colors[foreground], theme.colors[background]) >= 4.5,
        `${theme.mode} ${foreground}/${background} contrast must be at least 4.5:1`
      );
    }
  }
});

test('shared button presentation selects semantic variants and field-sized targets', () => {
  assert.equal(resolveButtonVariant(), 'primary');
  assert.equal(resolveButtonVariant({ tone: 'danger' }), 'danger');
  assert.equal(resolveButtonVariant({ variant: 'secondary' }), 'secondary');
  assert.deepEqual(buttonAppearance(lightTheme, 'danger'), {
    backgroundColor: lightTheme.colors.danger,
    color: lightTheme.colors.onDanger,
  });
  assert.equal(buttonAppearance(darkTheme, 'primary', true).backgroundColor, darkTheme.colors.primaryPressed);
  assert.equal(buttonHeightForVariant('primary'), tokens.interaction.primaryActionHeight);
  assert.equal(buttonHeightForVariant('secondary'), tokens.interaction.preferredTouchTarget);
});
