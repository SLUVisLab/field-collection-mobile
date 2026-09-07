import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { InferenceSession, listSupportedBackends, Tensor } from 'onnxruntime-react-native';
import { OpenCV } from 'react-native-fast-opencv';
import {
  ensureProjectDirectories,
  fileExists,
  fileForKey,
  readBytes,
  readText,
  writeBytesAtomic,
  writeTextAtomic,
} from 'gather-storage';
import { BUNDLED_MODEL_PACKAGES } from '../src/scientific/models/bundledModelPackages.js';
import { createModelStore } from '../src/scientific/models/modelStore.js';
import { createReactNativeOnnxRuntime } from '../src/scientific/runtime/onnxReactNativeAdapter.js';
import { createOpenCvImageAdapter } from '../src/scientific/runtime/openCvImageAdapter.js';
import { createOpenCvMeasurementAdapter } from '../src/scientific/runtime/openCvMeasurementAdapter.js';
import { createModelExecutor } from '../src/scientific/runtime/modelExecutor.js';
import { createImageAsset, createMaskAsset, sha256For } from '../src/scientific/contracts.js';
import { createSegmentAndMeasureResult } from '../src/scientific/workflows/segmentAndMeasure.js';
import { classify, segment } from '../src/capabilities/vision/index.js';

const MARKER = 'M80_NATIVE_SUBSTRATE_RESULT::';

export default function M80NativeSubstrateGateApp() {
  const started = useRef(false);
  const [result, setResult] = useState('Starting native substrate probe...');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let finished = false;
    const complete = (marker, value) => {
      if (finished) return;
      finished = true;
      const line = `${marker}${typeof value === 'string' ? value : JSON.stringify(value)}`;
      new File(Paths.document, 'm80-native-substrate-result.txt').write(line);
      console.log(line);
      setResult(typeof value === 'string' ? value : JSON.stringify(value));
    };
    const watchdog = setTimeout(() => complete('M80_NATIVE_SUBSTRATE_HANG::', 'M80_ONNX_INFERENCE_TIMEOUT'), 90_000);

    void (async () => {
      try {
        const backends = listSupportedBackends().map(({ name }) => name);
        const hasMat = typeof OpenCV?.Mat?.create === 'function';
        if (backends.length === 0 || !hasMat) throw new Error('M80_NATIVE_SUBSTRATE_UNAVAILABLE');
        const referenceResults = [];
        const modelStoreProject = 'm80-gate';
        ensureProjectDirectories(modelStoreProject);
        const modelStore = createModelStore({
          fileExists,
          fileForKey,
          readBytes,
          readText,
          writeBytesAtomic,
          writeTextAtomic,
        });
        const files = { fileForKey, readBytes, readText };

        const [model] = await Asset.loadAsync(require('./fixtures/onnx-add.onnx'));
        if (!model?.localUri) throw new Error('M80_ONNX_FIXTURE_UNAVAILABLE');
        const session = await InferenceSession.create(model.localUri);
        try {
          const dimensions = [3, 4, 5];
          const output = await session.run(
            {
              x: new Tensor('float32', new Float32Array(60), dimensions),
              y: new Tensor('float32', new Float32Array(60).fill(1), dimensions),
            },
            ['sum']
          );
          const values = Array.from(output.sum?.data ?? []);
          if (values.length !== 60 || values.some((value) => value !== 1)) {
            throw new Error('M80_ONNX_UNEXPECTED_RESULT');
          }
          referenceResults.push({
            model: 'onnx/backend/test/data/node/test_add@990217f043af7222348ca8f0301e17fa7b841781',
            output: { name: 'sum', dimensions: [...output.sum.dims], valueCount: values.length, valuesAreOne: true },
          });
        } finally {
          session.release?.();
        }
        const referenceModels = [
          { name: 'u2netp', packageName: 'u2netp', asset: require('../assets/scientific/models/u2netp.onnx'), input: [1, 3, 320, 320], output: 'saliency' },
          {
            name: 'mobilenet-v3-large',
            packageName: 'mobilenetV3Large',
            asset: require('../assets/scientific/models/mobilenet-v3-large-imagenet1k-v2.onnx'),
            labels: require('../assets/scientific/models/imagenet-1k-labels.txt'),
            input: [1, 3, 224, 224],
            output: 'logits',
          },
        ];
        for (const reference of referenceModels) {
          const [asset] = await Asset.loadAsync(reference.asset);
          if (!asset?.localUri) throw new Error(`M80_${reference.name}_ASSET_UNAVAILABLE`);
          const startedAt = Date.now();
          const referenceSession = await InferenceSession.create(asset.localUri);
          try {
            const output = await referenceSession.run({
              image: new Tensor('float32', new Float32Array(reference.input.reduce((total, dimension) => total * dimension, 1)), reference.input),
            }, [reference.output]);
            const values = Array.from(output[reference.output]?.data ?? []);
            if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
              throw new Error(`M80_${reference.name}_UNEXPECTED_RESULT`);
            }
            const [labelAsset] = reference.labels ? await Asset.loadAsync(reference.labels) : [null];
            const installed = await modelStore.install({
              projectKey: modelStoreProject,
              modelPackage: BUNDLED_MODEL_PACKAGES[reference.packageName],
              artifactBytes: await new File(asset.localUri).bytes(),
              labelBytes: labelAsset ? await new File(labelAsset.localUri).bytes() : null,
            });
            if (!installed.artifactPath || (reference.labels && !installed.labelsPath)) {
              throw new Error(`M80_${reference.name}_MODEL_STORE_FAILED`);
            }
            referenceResults.push({
              model: reference.name,
              output: { name: reference.output, dimensions: [...output[reference.output].dims], valueCount: values.length },
              elapsedMs: Date.now() - startedAt,
              modelStoreRevision: installed.modelRef.revision,
            });
          } finally {
            referenceSession.release?.();
          }
        }
        const inputPath = 'projects/m80-gate/media/m8-gate-input.png';
        const inputFile = fileForKey(inputPath);
        const inputMat = OpenCV.Mat.createFromBuffer(
          'uint8',
          2,
          2,
          3,
          new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255])
        );
        try {
          inputMat.saveToFile(inputFile.uri.replace(/^file:\/\//, ''), 'png', 1);
        } finally {
          inputMat.release();
        }
        const image = createImageAsset({
          assetId: 'm80-input',
          uri: inputFile.uri,
          path: inputPath,
          width: 2,
          height: 2,
          mimeType: 'image/png',
          sha256: sha256For(await readBytes(inputPath)),
        });
        const executor = createModelExecutor({
          modelStore,
          onnxRuntime: createReactNativeOnnxRuntime(),
          imageAdapter: createOpenCvImageAdapter(),
          files,
          newAssetId: () => 'm80-inferred-mask',
        });
        const segmentation = await segment({
          image,
          model: BUNDLED_MODEL_PACKAGES.u2netp,
          execute: (input) => executor.segment({ ...input, projectKey: modelStoreProject }),
        });
        const classification = await classify({
          image,
          model: BUNDLED_MODEL_PACKAGES.mobilenetV3Large,
          execute: (input) => executor.classify({ ...input, projectKey: modelStoreProject }),
        });
        const warmSegmentation = await segment({
          image,
          model: BUNDLED_MODEL_PACKAGES.u2netp,
          execute: (input) => executor.segment({ ...input, projectKey: modelStoreProject }),
        });
        const warmClassification = await classify({
          image,
          model: BUNDLED_MODEL_PACKAGES.mobilenetV3Large,
          execute: (input) => executor.classify({ ...input, projectKey: modelStoreProject }),
        });
        const hasWarmSessionCacheHit = (result) =>
          result.performance?.phases?.some((phase) => phase.phase === 'sessionCacheLookup' && phase.cacheHit === true);
        if (
          !segmentation.mask?.assetId ||
          classification.ranked?.length !== 5 ||
          !hasWarmSessionCacheHit(warmSegmentation) ||
          !hasWarmSessionCacheHit(warmClassification)
        ) {
          throw new Error('M80_MODEL_EXECUTOR_FAILED');
        }
        const fixtureMaskPath = 'projects/m80-gate/media/m8-gate-fixture-mask.png';
        const fixtureMaskFile = fileForKey(fixtureMaskPath);
        const fixtureMaskMat = OpenCV.Mat.createFromBuffer(
          'uint8',
          2,
          2,
          1,
          new Uint8Array([255, 255, 255, 0])
        );
        try {
          fixtureMaskMat.saveToFile(fixtureMaskFile.uri.replace(/^file:\/\//, ''), 'png', 1);
        } finally {
          fixtureMaskMat.release();
        }
        const fixtureMask = createMaskAsset({
          assetId: 'm80-fixture-mask',
          uri: fixtureMaskFile.uri,
          path: fixtureMaskPath,
          width: 2,
          height: 2,
          sha256: sha256For(await readBytes(fixtureMaskPath)),
          sourceImageAssetId: image.assetId,
        });
        const measurements = await createOpenCvMeasurementAdapter().maskMeasurements(fixtureMask);
        const imageMeasurements = await createOpenCvMeasurementAdapter().imageMeasurements(image, fixtureMask);
        const acceptedResult = createSegmentAndMeasureResult({
          image,
          segmentation,
          maskMeasurements: measurements,
          imageMeasurements,
          classification,
        });
        if (
          measurements.area.value !== 3 ||
          !Number.isFinite(imageMeasurements.sharpness.score) ||
          acceptedResult.provenance.executionReceipts.segmentation?.capability !== 'vision.segment'
        ) {
          throw new Error('M80_MEASUREMENT_ADAPTER_FAILED');
        }
        referenceResults.push({
          model: 'Gather Model Store and capability pipeline',
          segmentationMask: segmentation.mask.assetId,
          rankedClassCount: classification.ranked.length,
          fixtureAreaPx2: measurements.area.value,
          sharpnessMetric: imageMeasurements.sharpness.metric,
          acceptedResult: true,
          coldPerformance: {
            segmentation: segmentation.performance,
            classification: classification.performance,
          },
          warmPerformance: {
            segmentation: warmSegmentation.performance,
            classification: warmClassification.performance,
          },
        });
        complete(MARKER, { onnxBackends: backends, fastOpenCvMat: hasMat, referenceResults });
      } catch (error) {
        complete('M80_NATIVE_SUBSTRATE_CRASH::', typeof error?.message === 'string' ? error.message : 'M80_NATIVE_SUBSTRATE_FAILED');
      } finally {
        clearTimeout(watchdog);
      }
    })();
    return () => clearTimeout(watchdog);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text>{result}</Text>
    </View>
  );
}
