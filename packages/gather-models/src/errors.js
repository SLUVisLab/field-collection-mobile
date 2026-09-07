/**
 * A model package, reference or store operation was invalid.
 *
 * The model domain's own error: a malformed package, an unusable reference, or
 * a store operation that cannot be completed. A bad asset digest is
 * `MediaAssetError` and a failed OpenCV call is `ComputeError`, so a `catch`
 * here means the model is wrong and nothing else.
 */
export class ModelError extends Error {
  constructor(message, { code = 'GATHER_MODEL_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.cause = cause;
  }
}
