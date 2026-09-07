import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useLocation, useNavigate } from 'react-router-native';

import { makeHardwareBackHandler } from './backBehavior.js';
import { useBackGuardRegistry } from './BackGuardContext.js';

/**
 * Wires the Android hardware/gesture back button to the in-memory router.
 * `react-router-native`'s own back hook is a no-op in v6, so the shell registers
 * the policy from `backBehavior.js`: pop one entry on deep routes, and let the
 * OS exit the app when already on a shell root. Renders nothing.
 */
export function AndroidBackHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const backGuard = useBackGuardRegistry();

  useEffect(() => {
    const defaultHandler = makeHardwareBackHandler(location, navigate);
    const handler = () => {
      const guard = backGuard?.get();
      if (typeof guard === 'function') {
        guard();
        return true;
      }
      return defaultHandler();
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => {
      // RN >= 0.65 returns a subscription; guard for older shapes just in case.
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      } else {
        BackHandler.removeEventListener('hardwareBackPress', handler);
      }
    };
  }, [backGuard, location, navigate]);

  return null;
}
