import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Platform } from 'react-native';

import { createOnnxRuntime } from './onnxRuntime.js';
import { executionProvidersFor } from './executionProviders.js';

/**
 * The sole Gather import boundary for onnxruntime-react-native. Keep native
 * session/tensor values inside this module and onnxRuntime.js.
 */
export const createReactNativeOnnxRuntime = (options = {}) =>
  createOnnxRuntime({
    createSession: (path) =>
      InferenceSession.create(path, {
        executionProviders: executionProvidersFor(Platform.OS),
      }),
    createTensor: (type, data, dimensions) => new Tensor(type, data, dimensions),
    ...options,
  });
