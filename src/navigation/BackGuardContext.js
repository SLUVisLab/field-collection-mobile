import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

const BackGuardContext = createContext(null);

export function BackGuardProvider({ children }) {
  const guardRef = useRef(null);
  const register = useCallback((guard) => {
    guardRef.current = guard;
    return () => {
      if (guardRef.current === guard) guardRef.current = null;
    };
  }, []);
  const value = useMemo(() => ({ register, get: () => guardRef.current }), [register]);
  return <BackGuardContext.Provider value={value}>{children}</BackGuardContext.Provider>;
}

export const useBackGuardRegistry = () => useContext(BackGuardContext);
