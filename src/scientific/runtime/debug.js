/**
 * Development-only diagnostics for the scientific runtime. These logs never run
 * in release builds and never cross a capability boundary; they exist purely to
 * inspect preprocessing/inference numerics while validating on device.
 */
export const scientificDebugEnabled = () => typeof __DEV__ !== 'undefined' && __DEV__;

const numericStats = (values) => {
  const length = values.length;
  if (length === 0) return { count: 0 };
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    const value = values[index];
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }
  return { count: length, min, max, mean: sum / length };
};

export const logScientificStats = (label, fields) => {
  if (!scientificDebugEnabled()) return;
  const summary = {};
  for (const [key, value] of Object.entries(fields)) {
    summary[key] = ArrayBuffer.isView(value) || Array.isArray(value) ? numericStats(value) : value;
  }
  console.log(`[gather-scientific] ${label} ${JSON.stringify(summary)}`);
};
