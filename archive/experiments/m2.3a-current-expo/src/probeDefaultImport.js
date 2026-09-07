import { loadForm } from '@getodk/xforms-engine';

const { runXformsProbeWithLoadForm } = require('./probeCore.cjs');

export const runDefaultImportProbe = async () => {
  return runXformsProbeWithLoadForm(loadForm, 'default-import');
};
