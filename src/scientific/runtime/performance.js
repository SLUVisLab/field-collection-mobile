const now = () => globalThis.performance?.now?.() ?? Date.now();

export const createPerformanceTrace = () => {
  const startedAt = now();
  const phases = [];
  return {
    async measure(name, work) {
      const phaseStartedAt = now();
      const value = await work();
      phases.push({ name, elapsedMs: now() - phaseStartedAt });
      return value;
    },
    record(entry) {
      phases.push(entry);
    },
    finish() {
      return {
        elapsedMs: now() - startedAt,
        phases,
      };
    },
  };
};
