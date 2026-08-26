import { runOozcitakHermesGateProbe } from './probeLogic';

(() => {
  const result = runOozcitakHermesGateProbe();
  const payload = JSON.stringify({
    runtime: {
      hermesInternal: typeof HermesInternal !== 'undefined',
    },
    ...result,
  });

  console.log(`M2_OOZCITAK_HERMES_GATE::${payload}`);

  if (!result.ok) {
    throw new Error('M2_OOZCITAK_HERMES_GATE_FAILED');
  }
})();

