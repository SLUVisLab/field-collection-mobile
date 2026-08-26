import { runDistImportProbe } from '../src/probeDistImport';

(async () => {
  const result = await runDistImportProbe();
  console.log(
    `M23A_DIST_IMPORT::${JSON.stringify({
      runtime: {
        hermesInternal: typeof HermesInternal !== 'undefined',
      },
      ...result,
    })}`
  );

  if (!result.ok) {
    throw new Error('M23A_DIST_IMPORT_FAILED');
  }
})();
