import { createMaskAsset, ScientificContractError, sha256For } from '../contracts.js';
import { createScientificModelRef } from '../models/modelPackage.js';
import { createExecutionReceipt } from '../provenance/receipt.js';
import { binaryMask, rankedLabels, rgbToTensor, sigmoid } from './modelTransforms.js';
import { createPerformanceTrace } from './performance.js';
import { logScientificStats } from './debug.js';

const stepFor = (steps, operation) => steps.find((step) => step.operation === operation);

const centerCrop = ({ pixels, width, height, targetWidth, targetHeight }) => {
  if (targetWidth > width || targetHeight > height) {
    throw new ScientificContractError('Model crop exceeds decoded image.', { code: 'GATHER_MODEL_TRANSFORM_INVALID' });
  }
  const left = Math.floor((width - targetWidth) / 2);
  const top = Math.floor((height - targetHeight) / 2);
  const cropped = new Uint8Array(targetWidth * targetHeight * 3);
  for (let row = 0; row < targetHeight; row += 1) {
    const sourceStart = ((top + row) * width + left) * 3;
    cropped.set(pixels.subarray(sourceStart, sourceStart + targetWidth * 3), row * targetWidth * 3);
  }
  return { pixels: cropped, width: targetWidth, height: targetHeight };
};

export const createModelExecutor = ({ modelStore, onnxRuntime, imageAdapter, files, newAssetId }) => {
  if (!modelStore || !onnxRuntime || !imageAdapter || !files || typeof newAssetId !== 'function') {
    throw new ScientificContractError('Scientific model executor dependencies are unavailable.');
  }
  const preparedInput = async ({ image, model, trace }) => {
    const resize = stepFor(model.preprocessing, 'resize');
    const decoded = await trace.measure('imageDecodeResize', () =>
      imageAdapter.decodeResizeRgb({ image, resize })
    );
    const crop = stepFor(model.preprocessing, 'crop');
    const prepared = crop
      ? await trace.measure('imageCrop', () => centerCrop({ ...decoded, targetWidth: crop.width, targetHeight: crop.height }))
      : decoded;
    return {
      dimensions: model.tensor.inputShape,
      data: await trace.measure('pixelNormalizeTensor', () => {
        const tensor = rgbToTensor({ ...prepared, steps: model.preprocessing, inputShape: model.tensor.inputShape });
        logScientificStats(`${model.identity.id} input.tensor`, {
          decodedWidth: prepared.width,
          decodedHeight: prepared.height,
          tensor,
        });
        return tensor;
      }),
    };
  };
  const resolvedModel = async ({ projectKey, model, trace }) => {
    const resolved = await trace.measure('modelStoreResolve', () =>
      modelStore.resolve({ projectKey, modelRef: createScientificModelRef(model) })
    );
    return { resolved, runtimeModel: { ...model, artifact: { ...model.artifact, path: resolved.artifactPath } } };
  };

  return {
    async segment({ projectKey, image, model }) {
      const trace = createPerformanceTrace();
      const [input, modelResolution] = await Promise.all([
        preparedInput({ image, model, trace }),
        resolvedModel({ projectKey, model, trace }),
      ]);
      const outputs = await onnxRuntime.run({
        model: modelResolution.runtimeModel,
        inputName: model.tensor.inputName,
        inputData: input.data,
        inputDimensions: input.dimensions,
        outputNames: model.tensor.outputNames,
        onTiming: (entry) => trace.record(entry),
      });
      const output = outputs[model.tensor.outputNames[0]];
      const threshold = stepFor(model.postprocessing, 'threshold')?.value;
      if (!output || !Number.isFinite(threshold)) {
        throw new ScientificContractError('Segmentation result is missing its configured output.', {
          code: 'GATHER_VISION_POSTPROCESS_FAILED',
        });
      }
      const sourceMask = await trace.measure('segmentationPostprocess', () => {
        const activated = model.postprocessing.some((step) => step.operation === 'sigmoid')
          ? sigmoid(output.data)
          : output.data;
        logScientificStats(`${model.identity.id} output.saliency`, {
          raw: output.data,
          activated,
          threshold,
          foregroundRatio:
            activated.reduce((count, value) => count + (value >= threshold ? 1 : 0), 0) / activated.length,
        });
        return binaryMask({
          values: activated,
          threshold,
          width: model.tensor.inputShape[3],
          height: model.tensor.inputShape[2],
        });
      });
      const pixels = await trace.measure('maskRestoreSourceSize', () => imageAdapter.resizeMask({
        pixels: sourceMask,
        width: model.tensor.inputShape[3],
        height: model.tensor.inputShape[2],
        targetWidth: image.width,
        targetHeight: image.height,
      }));
      const assetId = newAssetId();
      const path = `projects/${projectKey}/media/${assetId}-mask.png`;
      const uri = files.fileForKey(path).uri;
      await trace.measure('maskMaterialize', () => imageAdapter.writeBinaryMaskPng({ pixels, width: image.width, height: image.height, uri }));
      const bytes = await trace.measure('maskHashRead', () => files.readBytes(path));
      const mask = await trace.measure('maskAssetCreate', () => createMaskAsset({
          assetId,
          uri,
          path,
          width: image.width,
          height: image.height,
          sha256: sha256For(bytes),
          sourceImageAssetId: image.assetId,
        }));
      return {
        mask,
        threshold,
        receipt: await trace.measure('receiptHash', () => createExecutionReceipt({
          capability: 'image.segment',
          capabilityRevision: '1',
          model: createScientificModelRef(model),
          inputs: { imageAssetId: image.assetId, imageSha256: image.sha256 },
          parameters: { threshold },
          outputs: { maskAssetId: mask.assetId, maskSha256: mask.sha256 },
          runtime: { adapter: 'onnxruntime-react-native' },
          timestamp: new Date().toISOString(),
        })),
        performance: trace.finish(),
      };
    },
    async classify({ projectKey, image, model }) {
      const trace = createPerformanceTrace();
      const [input, modelResolution] = await Promise.all([
        preparedInput({ image, model, trace }),
        resolvedModel({ projectKey, model, trace }),
      ]);
      const outputs = await onnxRuntime.run({
        model: modelResolution.runtimeModel,
        inputName: model.tensor.inputName,
        inputData: input.data,
        inputDimensions: input.dimensions,
        outputNames: model.tensor.outputNames,
        onTiming: (entry) => trace.record(entry),
      });
      const output = outputs[model.tensor.outputNames[0]];
      const count = stepFor(model.postprocessing, 'topK')?.count;
      if (!output || !modelResolution.resolved.labelsPath) {
        throw new ScientificContractError('Classification result is missing its configured output.', {
          code: 'GATHER_VISION_POSTPROCESS_FAILED',
        });
      }
      const labels = await trace.measure('labelsRead', async () =>
        (await files.readText(modelResolution.resolved.labelsKey)).trim().split(/\r?\n/)
      );
      const ranked = await trace.measure('classificationPostprocess', () => rankedLabels({ logits: output.data, labels, count }));
      logScientificStats(`${model.identity.id} output.logits`, { logits: output.data });
      if (ranked.length > 0) {
        logScientificStats(`${model.identity.id} ranked.top`, {
          top: ranked.slice(0, 5).map((item) => `${item.label}:${item.score.toFixed(3)}`).join(', '),
        });
      }
      return {
        ranked,
        receipt: await trace.measure('receiptHash', () => createExecutionReceipt({
          capability: 'image.classify',
          capabilityRevision: '1',
          model: createScientificModelRef(model),
          inputs: { imageAssetId: image.assetId, imageSha256: image.sha256 },
          parameters: { topK: count },
          outputs: { ranked },
          runtime: { adapter: 'onnxruntime-react-native' },
          timestamp: new Date().toISOString(),
        })),
        performance: trace.finish(),
      };
    },
  };
};
