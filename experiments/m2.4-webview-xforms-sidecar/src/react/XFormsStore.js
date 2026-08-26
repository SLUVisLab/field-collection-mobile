import { XFORMS_EVENT_TYPES, XFormsHostError } from '../host/XFormsHost';

export const XFORMS_REACT_PHASES = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
  DISPOSED: 'disposed',
});

const resolveError = (error, message) => {
  if (error instanceof Error) {
    return error;
  }
  return new XFormsHostError(message, {
    details: { originalError: String(error) },
  });
};

const shallowEqual = (a, b) => {
  if (Object.is(a, b)) {
    return true;
  }
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }
    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
};

export class XFormsStore {
  constructor({ host }) {
    this.host = host;
    this.listeners = new Set();
    this.hostUnsubscribe = null;
    this.disposed = false;
    this.refreshInFlight = null;
    this.state = {
      phase: XFORMS_REACT_PHASES.IDLE,
      snapshot: null,
      error: null,
      lastEvent: null,
      updatedAt: Date.now(),
    };
  }

  getState() {
    return this.state;
  }

  getSelection(selector) {
    return selector(this.state);
  }

  setState(patch) {
    if (this.disposed) {
      return;
    }
    const nextState = {
      ...this.state,
      ...patch,
      updatedAt: Date.now(),
    };
    if (shallowEqual(this.state, nextState)) {
      return;
    }
    this.state = nextState;
    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeToSelection(selector, isEqual, listener) {
    let lastSelection = selector(this.state);
    return this.subscribe(() => {
      const nextSelection = selector(this.state);
      if (!isEqual(lastSelection, nextSelection)) {
        lastSelection = nextSelection;
        listener();
      }
    });
  }

  ensureNotDisposed() {
    if (this.disposed) {
      throw new XFormsHostError('XFormsStore has been disposed');
    }
  }

  start() {
    this.ensureNotDisposed();
    if (this.hostUnsubscribe != null) {
      return;
    }
    this.hostUnsubscribe = this.host.subscribe((event) => {
      this.handleHostEvent(event);
    });
  }

  async initialize() {
    this.ensureNotDisposed();
    this.start();
    this.setState({
      phase: XFORMS_REACT_PHASES.LOADING,
      error: null,
    });
    try {
      const value = await this.host.initialize();
      this.setState({
        phase: XFORMS_REACT_PHASES.READY,
        error: null,
      });
      return value;
    } catch (error) {
      const resolved = resolveError(error, 'Failed to initialize host');
      this.setState({
        phase: XFORMS_REACT_PHASES.ERROR,
        error: resolved,
      });
      throw resolved;
    }
  }

  async loadForm(xml) {
    this.ensureNotDisposed();
    this.start();
    this.setState({
      phase: XFORMS_REACT_PHASES.LOADING,
      error: null,
    });
    try {
      await this.host.initialize();
      const loadResult = await this.host.loadForm(xml);
      const snapshot = loadResult?.snapshot ?? (await this.host.getSnapshot());
      this.setState({
        phase: XFORMS_REACT_PHASES.READY,
        snapshot,
        error: null,
      });
      return loadResult;
    } catch (error) {
      const resolved = resolveError(error, 'Failed to load form');
      this.setState({
        phase: XFORMS_REACT_PHASES.ERROR,
        error: resolved,
      });
      throw resolved;
    }
  }

  async refreshSnapshot(reason = 'manual') {
    this.ensureNotDisposed();
    this.start();
    if (this.refreshInFlight != null) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = (async () => {
      try {
        const snapshot = await this.host.getSnapshot();
        this.setState({
          phase: XFORMS_REACT_PHASES.READY,
          snapshot,
          error: null,
          lastEvent: {
            type: XFORMS_EVENT_TYPES.LIFECYCLE,
            payload: { phase: 'snapshot-refresh', reason },
          },
        });
        return snapshot;
      } catch (error) {
        const resolved = resolveError(error, 'Failed to refresh snapshot');
        this.setState({
          phase: XFORMS_REACT_PHASES.ERROR,
          error: resolved,
        });
        throw resolved;
      } finally {
        this.refreshInFlight = null;
      }
    })();
    return this.refreshInFlight;
  }

  async setValue(reference, value) {
    this.ensureNotDisposed();
    this.start();
    try {
      const result = await this.host.setValue(reference, value);
      const snapshot = result?.snapshot ?? (await this.host.getSnapshot());
      this.setState({
        phase: XFORMS_REACT_PHASES.READY,
        snapshot,
        error: null,
      });
      return result;
    } catch (error) {
      const resolved = resolveError(error, `Failed to set value for ${reference}`);
      this.setState({
        phase: XFORMS_REACT_PHASES.ERROR,
        error: resolved,
      });
      throw resolved;
    }
  }

  async addRepeat(reference) {
    this.ensureNotDisposed();
    this.start();
    try {
      const result = await this.host.addRepeat(reference);
      const snapshot = result?.snapshot ?? (await this.host.getSnapshot());
      this.setState({
        phase: XFORMS_REACT_PHASES.READY,
        snapshot,
        error: null,
      });
      return result;
    } catch (error) {
      const resolved = resolveError(error, `Failed to add repeat for ${reference}`);
      this.setState({
        phase: XFORMS_REACT_PHASES.ERROR,
        error: resolved,
      });
      throw resolved;
    }
  }

  async removeRepeat(reference, instanceId = null) {
    this.ensureNotDisposed();
    this.start();
    try {
      const result = await this.host.removeRepeat(reference, instanceId);
      const snapshot = result?.snapshot ?? (await this.host.getSnapshot());
      this.setState({
        phase: XFORMS_REACT_PHASES.READY,
        snapshot,
        error: null,
      });
      return result;
    } catch (error) {
      const resolved = resolveError(error, `Failed to remove repeat for ${reference}`);
      this.setState({
        phase: XFORMS_REACT_PHASES.ERROR,
        error: resolved,
      });
      throw resolved;
    }
  }

  async serialize() {
    this.ensureNotDisposed();
    this.start();
    try {
      return await this.host.serialize();
    } catch (error) {
      const resolved = resolveError(error, 'Failed to serialize');
      this.setState({
        phase: XFORMS_REACT_PHASES.ERROR,
        error: resolved,
      });
      throw resolved;
    }
  }

  async inspectMediaSeam() {
    this.ensureNotDisposed();
    this.start();
    try {
      return await this.host.inspectMediaSeam();
    } catch (error) {
      const resolved = resolveError(error, 'Failed to inspect media seam');
      this.setState({
        phase: XFORMS_REACT_PHASES.ERROR,
        error: resolved,
      });
      throw resolved;
    }
  }

  handleHostEvent(event) {
    this.setState({ lastEvent: event });
    if (event?.type === XFORMS_EVENT_TYPES.STATE_CHANGED) {
      this.refreshSnapshot('stateChanged').catch((error) => {
        const resolved = resolveError(error, 'Failed to refresh snapshot after stateChanged event');
        this.setState({
          phase: XFORMS_REACT_PHASES.ERROR,
          error: resolved,
        });
      });
      return;
    }
    if (event?.type === XFORMS_EVENT_TYPES.LIFECYCLE) {
      this.refreshSnapshot('lifecycle').catch((error) => {
        const resolved = resolveError(error, 'Failed to refresh snapshot after lifecycle event');
        this.setState({
          phase: XFORMS_REACT_PHASES.ERROR,
          error: resolved,
        });
      });
    }
  }

  async dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.hostUnsubscribe != null) {
      this.hostUnsubscribe();
      this.hostUnsubscribe = null;
    }
    this.listeners.clear();
    this.state = {
      ...this.state,
      phase: XFORMS_REACT_PHASES.DISPOSED,
      updatedAt: Date.now(),
    };
    await this.host.dispose();
  }
}

export const areNodeStatesEqual = (left, right) => {
  if (Object.is(left, right)) {
    return true;
  }
  if (left == null || right == null) {
    return left === right;
  }
  return (
    left.reference === right.reference &&
    Object.is(left.value, right.value) &&
    Object.is(left.relevant, right.relevant) &&
    Object.is(left.required, right.required) &&
    Object.is(left.constraintValid, right.constraintValid) &&
    Object.is(left.readonly, right.readonly)
  );
};
