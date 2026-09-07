import { loadForm } from '@getodk/xforms-engine/dist/index.js';

const { runXformsProbeWithLoadForm } = require('./probeCore.cjs');

export const runDistImportProbe = async () => {
  return runXformsProbeWithLoadForm(loadForm, 'dist-import');
};
