import { runDefaultImportProbe } from '../src/probeDefaultImport';

(async () => {
  const result = await runDefaultImportProbe();
  console.log(
    `M23A_DEFAULT_IMPORT::${JSON.stringify({
      runtime: {
        hermesInternal: typeof HermesInternal !== 'undefined',
      },
      ...result,
    })}`
  );

  if (!result.ok) {
    throw new Error('M23A_DEFAULT_IMPORT_FAILED');
  }
})();
