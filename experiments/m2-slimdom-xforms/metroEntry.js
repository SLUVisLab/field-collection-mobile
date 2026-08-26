const { runSlimdomXformsHermesProbe } = require('./xformsHermesProbe');

(async () => {
  const result = await runSlimdomXformsHermesProbe();
  console.log(
    `M2_SLIMDOM_XFORMS_HERMES::${JSON.stringify({
      runtime: {
        hermesInternal: typeof HermesInternal !== 'undefined',
      },
      ...result,
    })}`
  );

  if (!result.ok) {
    throw new Error('M2_SLIMDOM_XFORMS_HERMES_FAILED');
  }
})();
