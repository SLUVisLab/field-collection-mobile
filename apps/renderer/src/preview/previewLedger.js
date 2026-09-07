/**
 * What actually ran, and whether it was real.
 *
 * The renderer's preview cannot execute every Capability for real yet, and a
 * Tool that *looks* like it segmented an image when it drew a fixture is the
 * kind of lie that survives all the way to a field deployment. So every preview
 * execution records itself here and the surface says so, rather than the
 * honesty living in a comment nobody reads.
 */
const listeners = new Set();
const entries = [];

/** `fidelity` is the whole point: 'real' means this is what the device does. */
export const recordPreviewExecution = ({ name, fidelity, detail = null }) => {
  entries.push({ name, fidelity, detail, at: Date.now() });
  for (const listener of listeners) listener([...entries]);
};

export const subscribeToPreviewLedger = (listener) => {
  listeners.add(listener);
  listener([...entries]);
  return () => listeners.delete(listener);
};

export const clearPreviewLedger = () => {
  entries.length = 0;
  for (const listener of listeners) listener([]);
};
