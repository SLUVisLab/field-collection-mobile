const xformsEngine = require('@getodk/xforms-engine');

console.log(
  `M2_XFORMS_DEFAULT_IMPORT::${JSON.stringify({
    hasLoadForm: typeof xformsEngine.loadForm === 'function',
  })}`
);
