import { loadForm } from '@getodk/xforms-engine';

console.log(
  `M23B_MINIMAL_EXPORT::${JSON.stringify({
    ok: typeof loadForm === 'function',
    exportType: typeof loadForm,
    hermesInternal: typeof HermesInternal !== 'undefined',
  })}`
);
