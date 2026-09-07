/**
 * Hardware-back policy — PURE logic (no React / React Native imports).
 *
 * React Native's `BackHandler` fires on the Android hardware/gesture back. A
 * registered handler returns `true` to CONSUME the event (we handled it) or
 * `false` to let the default happen (which, at the top of the stack, exits the
 * app). `react-router-native`'s own `useHardwareBackButton` is a no-op in v6, so
 * the shell wires this policy itself.
 *
 * Policy:
 *   - On a shell ROOT route → don't consume; let Android exit the app.
 *   - On any deeper route   → consume and pop one entry from history.
 */

import { isRootPath } from './routes.js';

/**
 * Decide what a hardware-back press should do for the current location.
 *
 * @param {{ pathname: string }} location  current router location
 * @returns {{ consume: boolean, action: 'exit' | 'back' }}
 */
export const resolveHardwareBack = (location) => {
  const pathname = location && typeof location.pathname === 'string' ? location.pathname : '';
  if (isRootPath(pathname)) {
    return { consume: false, action: 'exit' };
  }
  return { consume: true, action: 'back' };
};

/**
 * Build the `BackHandler` callback for a location + navigate function. The
 * returned function is what React Native calls on each back press; it performs
 * the pop when appropriate and returns the boolean RN expects.
 *
 * @param {{ pathname: string }} location
 * @param {(delta: number) => void} navigate  e.g. react-router's `navigate`
 */
export const makeHardwareBackHandler = (location, navigate) => () => {
  const { consume, action } = resolveHardwareBack(location);
  if (action === 'back') {
    navigate(-1);
  }
  return consume;
};
