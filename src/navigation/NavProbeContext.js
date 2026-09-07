import { createContext, useContext } from 'react';

/**
 * Optional observability seam for the navigation gate. Screens report their id
 * on mount; production supplies the default no-op, while the Android navigation
 * gate supplies a collector that records which screens rendered.
 */
export const NavProbeContext = createContext({ reportScreen: () => {} });

export const useNavProbe = () => useContext(NavProbeContext);
