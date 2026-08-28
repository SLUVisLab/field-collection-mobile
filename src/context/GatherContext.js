import { createContext, useContext } from 'react';

/**
 * App-wide Gather context. Holds the bootstrapped storage handles,
 * repositories, and the current active project, plus the actions that mutate the
 * active-project selection. Route components read this via the hooks below and
 * never talk to `gather-storage` (or run bootstrap logic) directly.
 */
export const GatherContext = createContext(null);

export const useGather = () => {
  const ctx = useContext(GatherContext);
  if (!ctx) {
    throw new Error('useGather must be used within a <GatherProvider>');
  }
  return ctx;
};

/** Convenience: the projects repository. */
export const useProjectsRepository = () => useGather().repositories.projects;

/** Convenience: the currently active project (or null in the setup shell). */
export const useActiveProject = () => useGather().activeProject;
