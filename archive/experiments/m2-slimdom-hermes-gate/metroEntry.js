const { runSlimdomHermesGateProbe } = require('./probeLogic');

(() => {
  const result = runSlimdomHermesGateProbe();
  const payload = JSON.stringify({
    runtime: {
      hermesInternal: typeof HermesInternal !== 'undefined',
    },
    ...result,
  });

  console.log(`M2_SLIMDOM_HERMES_GATE::${payload}`);

  if (!result.ok) {
    throw new Error('M2_SLIMDOM_HERMES_GATE_FAILED');
  }
})();
