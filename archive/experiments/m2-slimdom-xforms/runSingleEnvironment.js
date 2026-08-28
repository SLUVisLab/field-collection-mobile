#!/usr/bin/env node

const { installJsdomDomCompatibility } = require('./installJsdomCompatibility');
const { installSlimdomDomCompatibility } = require('./installDomCompatibility');
const { runXformsScenario } = require('./xformsScenario');

const prefix = 'M2_XFORMS_ENV_RESULT::';

const resolveEnvironment = () => {
  const value = process.argv[2];
  if (value === 'jsdom' || value === 'slimdom') {
    return value;
  }
  throw new Error('Usage: node runSingleEnvironment.js <jsdom|slimdom>');
};

const main = async () => {
  const env = resolveEnvironment();

  let restoreEnvironment = null;
  try {
    restoreEnvironment =
      env === 'jsdom'
        ? installJsdomDomCompatibility({ force: true })
        : installSlimdomDomCompatibility({ force: true });

    const xformsEngine = await import('@getodk/xforms-engine');
    const scenarioResult = await runXformsScenario({
      loadForm: xformsEngine.loadForm,
    });

    console.log(
      `${prefix}${JSON.stringify({
        env,
        scenarioResult,
      })}`
    );
  } catch (error) {
    const resolvedError = error instanceof Error ? error : new Error(String(error));
    console.log(
      `${prefix}${JSON.stringify({
        env,
        fatalError: {
          name: resolvedError.name,
          message: resolvedError.message,
          stack: resolvedError.stack,
        },
      })}`
    );
    process.exitCode = 1;
  } finally {
    restoreEnvironment?.restore();
  }
};

main();
