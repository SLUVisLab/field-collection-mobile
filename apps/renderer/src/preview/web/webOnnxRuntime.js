/**
 * ONNX Runtime Web, behind the same `run()` the native runtime implements.
 *
 * This is the whole substitution the architecture was shaped for:
 *
 * ```text
 * image.segment → createCapabilityRuntime → execution provider → ORT
 *                                                                 ├ native (device)
 *                                                                 └ ORT-Web (here)
 * ```
 *
 * The Capability, the ModelRef, the ModelPackage, the authored Tool and the
 * A2UI function schema are all untouched by it.
 */
import * as ort from 'onnxruntime-web';

export const ONNX_RUNTIME_WEB = Object.freeze({
  id: 'onnxruntime-web',
  version: ort.env?.versions?.common ?? 'unknown',
});

export const createWebOnnxRuntime = () => {
  const sessions = new Map();

  const sessionFor = async (bytes, key) => {
    if (sessions.has(key)) return sessions.get(key);
    // WASM only: a preview that silently chose WebGL could differ from the
    // device for reasons nobody would think to look for.
    const session = await ort.InferenceSession.create(bytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    sessions.set(key, session);
    return session;
  };

  return {
    async run({ model, inputName, inputData, inputDimensions, outputNames, onTiming }) {
      const startedAt = performance.now();
      // `artifact.path` is the bytes themselves here — see webModelProvider.
      const session = await sessionFor(model.artifact.path, model.identity.revision ?? model.artifact.sha256);
      onTiming?.({ name: 'sessionReady', elapsedMs: performance.now() - startedAt });

      const ranAt = performance.now();
      const feeds = { [inputName]: new ort.Tensor('float32', inputData, inputDimensions) };
      const results = await session.run(feeds);
      onTiming?.({ name: 'inference', elapsedMs: performance.now() - ranAt });

      const outputs = {};
      for (const name of outputNames) {
        const tensor = results[name];
        if (tensor) outputs[name] = { data: tensor.data, dimensions: tensor.dims };
      }
      return outputs;
    },
  };
};
