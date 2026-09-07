/**
 * Error thrown by capability implementations when an input contract is violated
 * or the injected runtime is unavailable. Callers read `.message`; `.code` is a
 * stable machine-readable tag.
 */
export class CapabilityError extends Error {
  constructor(message, { code = 'GATHER_CAPABILITY_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'CapabilityError';
    this.code = code;
    this.cause = cause;
  }
}

export const capabilityError = (message, code) => new CapabilityError(message, { code });
