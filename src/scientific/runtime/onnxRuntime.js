import { ScientificContractError } from '../contracts.js';

/**
 * Bounded, library-contained ONNX session cache. Its only output is plain
 * result data; InferenceSession and Tensor objects cannot cross this boundary.
 */
export const createOnnxRuntime = ({ createSession, createTensor, maxSessions = 2, onTiming = null } = {}) => {
  if (typeof createSession !== 'function' || typeof createTensor !== 'function') {
    throw new ScientificContractError('ONNX runtime dependencies are unavailable.', {
      code: 'GATHER_ONNX_UNAVAILABLE',
    });
  }
  if (!Number.isInteger(maxSessions) || maxSessions < 1) {
    throw new ScientificContractError('ONNX session cache size must be positive.');
  }
  const sessions = new Map();

  const sessionFor = async (model, timing) => {
    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    const key = `${model.identity.id}:${model.artifact.sha256}`;
    if (sessions.has(key)) {
      const cached = sessions.get(key);
      sessions.delete(key);
      sessions.set(key, cached);
      (timing ?? onTiming)?.({ phase: 'sessionCacheLookup', cacheHit: true, elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startedAt });
      return cached;
    }
    const session = await createSession(model.artifact.path);
    (timing ?? onTiming)?.({ phase: 'sessionCreate', cacheHit: false, elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startedAt });
    sessions.set(key, session);
    if (sessions.size > maxSessions) {
      const [oldestKey, oldest] = sessions.entries().next().value;
      sessions.delete(oldestKey);
      oldest.release?.();
    }
    return session;
  };

  return {
    async run({ model, inputName, inputData, inputDimensions, outputNames, onTiming: timing = null }) {
      if (!(inputData instanceof Float32Array) || !Array.isArray(inputDimensions)) {
        throw new ScientificContractError('ONNX input must be a Float32Array with dimensions.', {
          code: 'GATHER_ONNX_INVALID_INPUT',
        });
      }
      const session = await sessionFor(model, timing);
      let outputs;
      const runStartedAt = globalThis.performance?.now?.() ?? Date.now();
      try {
        outputs = await session.run(
          { [inputName]: createTensor('float32', inputData, inputDimensions) },
          outputNames
        );
      } catch (cause) {
        throw new ScientificContractError('ONNX inference failed.', {
          code: 'GATHER_ONNX_INFERENCE_FAILED',
          cause,
        });
      }
      (timing ?? onTiming)?.({ phase: 'sessionRun', elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - runStartedAt });
      return Object.fromEntries(
        Object.entries(outputs).map(([name, tensor]) => [
          name,
          { dimensions: [...tensor.dims], data: Array.from(tensor.data) },
        ])
      );
    },
    dispose() {
      sessions.forEach((session) => session.release?.());
      sessions.clear();
    },
  };
};
