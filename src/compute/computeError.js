/**
 * On-device execution failed — an ONNX session, an OpenCV call, a tensor
 * transform, or the inference pipeline that drives them.
 *
 * Distinct from `ModelError`, which means the model itself is wrong rather
 * than the machinery that runs it.
 */
export class ComputeError extends Error {
  constructor(message, { code = 'GATHER_COMPUTE_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'ComputeError';
    this.code = code;
    this.cause = cause;
  }
}
