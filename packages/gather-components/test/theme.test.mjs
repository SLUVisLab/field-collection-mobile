import test from 'node:test';
import assert from 'node:assert/strict';

import { GATHER_LAYOUT_TOKENS, tokens } from '../src/theme/tokens.js';
import { GATHER_PALETTE, palette } from '../src/theme/palette.js';
import { REQUIRED_COLOR_KEYS, darkTheme, lightTheme, resolveTheme } from '../src/theme/themes.js';
import { buttonAppearance, buttonHeightForVariant, resolveButtonVariant } from '../src/theme/buttonPresentation.js';

test('theme primitives expose the shared Gather Components contract', () => {
  assert.equal(palette, GATHER_PALETTE);
  assert.equal(tokens, GATHER_LAYOUT_TOKENS);
});

test('semantic themes expose every required color role', () => {
  for (const theme of [lightTheme, darkTheme]) {
    for (const key of REQUIRED_COLOR_KEYS) {
      assert.ok(theme.colors[key], `${theme.mode} theme missing ${key}`);
    }
  }
  assert.equal(resolveTheme('dark'), darkTheme);
  assert.equal(resolveTheme('light'), lightTheme);
  assert.equal(resolveTheme(undefined), lightTheme);
});

test('button presentation resolves semantic variants and field-sized targets', () => {
  assert.equal(resolveButtonVariant({ variant: 'secondary' }), 'secondary');
  assert.equal(resolveButtonVariant({ tone: 'danger' }), 'danger');
  assert.equal(resolveButtonVariant({}), 'primary');

  const primary = buttonAppearance(lightTheme, 'primary');
  assert.equal(primary.backgroundColor, lightTheme.colors.primary);
  assert.equal(primary.color, lightTheme.colors.onPrimary);

  const secondaryPressed = buttonAppearance(lightTheme, 'secondary', true);
  assert.equal(secondaryPressed.backgroundColor, lightTheme.colors.secondaryPressed);

  assert.equal(buttonHeightForVariant('primary'), GATHER_LAYOUT_TOKENS.interaction.primaryActionHeight);
  assert.equal(buttonHeightForVariant('secondary'), GATHER_LAYOUT_TOKENS.interaction.preferredTouchTarget);
});
