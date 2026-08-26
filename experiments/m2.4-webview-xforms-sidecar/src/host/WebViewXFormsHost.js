import { XFormsHost } from './XFormsHost';

const createError = (message, cause) => {
  const error = new Error(message);
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
};

export class WebViewXFormsHost extends XFormsHost {
  constructor({ webViewRef, requestTimeoutMs = 15000 } = {}) {
    super();
    this.webViewRef = webViewRef;
    this.requestTimeoutMs = requestTimeoutMs;
    this.pending = new Map();
    this.listeners = new Set();
    this.metrics = [];
    this.nextId = 1;
    this.disposed = false;
    this.readyState = {
      seen: false,
      payload: null,
      promise: null,
      resolve: null,
      reject: null,
      timer: null,
    };
    this.resetReadyPromise();
  }

  resetReadyPromise() {
    this.readyState.promise = new Promise((resolve, reject) => {
      this.readyState.resolve = resolve;
      this.readyState.reject = reject;
    });
    this.readyState.seen = false;
    this.readyState.payload = null;
    if (this.readyState.timer != null) {
      clearTimeout(this.readyState.timer);
    }
    this.readyState.timer = setTimeout(() => {
      if (!this.readyState.seen) {
        this.readyState.reject(createError('WebView sidecar did not emit ready signal in time'));
      }
    }, this.requestTimeoutMs);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('Listener threw', error);
      }
    }
  }

  handleWebViewMessage(event) {
    if (this.disposed) {
      return;
    }
    const raw = event?.nativeEvent?.data;
    if (typeof raw !== 'string' || raw.length === 0) {
      return;
    }

    let message;
    try {
      message = JSON.parse(raw);
    } catch (error) {
      this.emit({
        type: 'log',
        payload: {
          level: 'error',
          source: 'bridge-parse',
          raw,
          error: String(error),
        },
      });
      return;
    }

    if (message.type === 'ready') {
      this.readyState.seen = true;
      this.readyState.payload = message.payload ?? null;
      if (this.readyState.timer != null) {
        clearTimeout(this.readyState.timer);
        this.readyState.timer = null;
      }
      this.readyState.resolve(message.payload ?? null);
      this.emit({
        type: 'lifecycle',
        payload: {
          phase: 'ready',
          details: message.payload ?? null,
        },
      });
      return;
    }

    if (message.type === 'event') {
      this.emit({
        type: message.eventType ?? 'log',
        payload: message.payload ?? null,
      });
      return;
    }

    if (message.type !== 'response') {
      this.emit({
        type: 'log',
        payload: {
          level: 'warn',
          source: 'bridge-unknown',
          message,
        },
      });
      return;
    }

    const pending = this.pending.get(message.id);
    if (pending == null) {
      this.emit({
        type: 'log',
        payload: {
          level: 'warn',
          source: 'bridge-orphan-response',
          message,
        },
      });
      return;
    }
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);

    const metric = {
      id: message.id,
      requestType: pending.type,
      queuedAtMs: pending.startedAt,
      completedAtMs: Date.now(),
      roundTripMs: Date.now() - pending.startedAt,
      sidecarLatencyMs: message.latencyMs ?? null,
      ok: message.ok === true,
    };
    this.metrics.push(metric);

    if (message.ok === true) {
      pending.resolve(message.payload ?? null);
    } else {
      this.emit({
        type: 'log',
        payload: {
          level: 'error',
          source: 'bridge-response-error',
          response: message,
        },
      });
      pending.reject(
        createError(
          `${pending.type} failed: ${message.error?.name ?? 'Error'}: ${message.error?.message ?? 'unknown'}${
            message.error?.stack ? `\n${message.error.stack}` : ''
          }`
        )
      );
    }
  }

  async waitForReady() {
    if (this.disposed) {
      throw createError('Host already disposed');
    }
    return this.readyState.promise;
  }

  injectRequest(request) {
    const webView = this.webViewRef?.current;
    if (webView == null || typeof webView.injectJavaScript !== 'function') {
      throw createError('WebView ref is unavailable');
    }
    const script = `window.__xformsSidecarReceive(${JSON.stringify(request)}); true;`;
    webView.injectJavaScript(script);
  }

  async sendRequest(type, payload = null) {
    if (this.disposed) {
      throw createError('Host already disposed');
    }
    await this.waitForReady();

    const id = `req-${this.nextId++}`;
    const startedAt = Date.now();
    const request = {
      id,
      type,
      payload,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(createError(`Request timed out: ${type}`));
      }, this.requestTimeoutMs);

      this.pending.set(id, {
        id,
        type,
        startedAt,
        timeout,
        resolve,
        reject,
      });

      try {
        this.injectRequest(request);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(createError(`Failed to inject request: ${type}`, error));
      }
    });
  }

  async initialize() {
    return this.sendRequest('initialize', {});
  }

  async loadForm(xml) {
    return this.sendRequest('loadForm', { xml });
  }

  async getSnapshot() {
    return this.sendRequest('getSnapshot', {});
  }

  async setValue(nodeId, value) {
    return this.sendRequest('setValue', { nodeId, value });
  }

  async addRepeat(repeatId) {
    return this.sendRequest('addRepeat', { repeatId });
  }

  async removeRepeat(repeatId, instanceId = null) {
    return this.sendRequest('removeRepeat', { repeatId, instanceId });
  }

  async serialize() {
    return this.sendRequest('serialize', {});
  }

  async inspectMediaSeam() {
    return this.sendRequest('inspectMediaSeam', {});
  }

  getMetrics() {
    return [...this.metrics];
  }

  async dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(createError('Host disposed while request was pending'));
    }
    this.pending.clear();
    if (this.readyState.timer != null) {
      clearTimeout(this.readyState.timer);
      this.readyState.timer = null;
    }
    this.readyState.reject(createError('Host disposed'));
    this.listeners.clear();
  }
}
