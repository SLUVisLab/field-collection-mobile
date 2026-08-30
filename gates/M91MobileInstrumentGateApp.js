import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Catalog } from '@a2ui/web_core/v0_9/catalog';
import { ColumnApi, TextApi } from '@a2ui/web_core/v0_9/basic_catalog';
import { MessageProcessor } from '@a2ui/web_core/v0_9/processor';

import { createCapabilityActionHandler } from '../src/a2ui/capabilityActionAdapter.js';
import { A2uiInstrumentSurface, mobileBasicImplementations } from '../src/a2ui/mobile/InstrumentSurface.js';
import { gatherCaptureApi, maskReviewApi, segmentAndMeasureImplementations } from '../src/a2ui/mobile/segmentAndMeasureComponents.js';
import { GATHER_ACTION_IDS, GATHER_CATALOG_ID, SEGMENT_AND_MEASURE_INSTRUMENT } from 'gather-catalog';

const MARKER = 'M91_MOBILE_INSTRUMENT_RESULT::';
const image = { assetId: 'fixture-image', uri: 'https://placehold.co/960x640/jpeg', path: 'fixtures/image.jpg', width: 960, height: 640, mimeType: 'image/jpeg', sha256: `sha256:${'1'.repeat(64)}`, orientation: null, capturedAt: '2026-01-01T00:00:00.000Z' };
const mask = { assetId: 'fixture-mask', uri: 'https://placehold.co/960x640/000000/00ff66.png', path: 'fixtures/mask.png', width: 960, height: 640, mimeType: 'image/png', sha256: `sha256:${'2'.repeat(64)}` };
const model = { id: 'fixture-model', version: '0.1.0' };
const capabilities = {
  capture: async () => ({ path: 'fixtures/camera.jpg' }),
  persistScientificCapture: async () => image,
  segmentScientificImage: async ({ image: input }) => ({ image: input, model, mask, threshold: 0.5, receipt: { id: 'fixture-segmentation' }, performance: null }),
  classifyScientificImage: async ({ image: input }) => ({ image: input, model, ranked: [{ label: 'fixture specimen', score: 0.99 }], receipt: { id: 'fixture-classification' }, performance: null }),
  measureScientificMask: async () => ({ area: { value: 3200, unit: 'px2' }, perimeter: { value: 280, unit: 'px' }, boundingBox: { width: 80, height: 40, unit: 'px' }, centroid: { x: 40, y: 20, unit: 'px' } }),
  measureScientificImage: async () => ({ color: { colorSpace: 'sRGB', channels: { red: 90, green: 120, blue: 70 } }, sharpness: { metric: 'variance-of-laplacian', score: 42 } }),
};

const catalog = new Catalog(GATHER_CATALOG_ID, [ColumnApi, TextApi, gatherCaptureApi, maskReviewApi]);
const implementations = { ...mobileBasicImplementations, ...segmentAndMeasureImplementations };

export default function M91MobileInstrumentGateApp() {
  const started = useRef(false);
  const [result, setResult] = useState('Starting mobile A2UI instrument gate...');
  let handleAction;
  const processor = useMemo(() => {
    const next = new MessageProcessor([catalog], (action) => handleAction?.(action));
    next.processMessages(SEGMENT_AND_MEASURE_INSTRUMENT.messages);
    next.model.getSurface(SEGMENT_AND_MEASURE_INSTRUMENT.surfaceId).dataModel.set('/gather/phase', 'persisting-capture');
    return next;
  }, []);
  handleAction = createCapabilityActionHandler({ processor, capabilities });
  const surface = processor.model.getSurface(SEGMENT_AND_MEASURE_INSTRUMENT.surfaceId);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      await surface.dispatchAction({ event: { name: GATHER_ACTION_IDS.capture } }, 'capture');
      await surface.dispatchAction({ event: { name: GATHER_ACTION_IDS.accept } }, 'review');
      const state = processor.getClientDataModel()?.surfaces[SEGMENT_AND_MEASURE_INSTRUMENT.surfaceId]?.gather;
      const ok = state?.phase === 'accepted'
        && state.result?.image?.assetId === 'fixture-image'
        && state.result?.segmentation?.mask?.assetId === 'fixture-mask'
        && state.result?.provenance?.classificationModel?.id === 'fixture-model';
      const value = { ok, phase: state?.phase, resultAssetId: state?.result?.image?.assetId ?? null };
      console.log(`${MARKER}${JSON.stringify(value)}`);
      setResult(JSON.stringify(value));
    })().catch((error) => {
      const value = { ok: false, message: error instanceof Error ? error.message : String(error) };
      console.log(`${MARKER}${JSON.stringify(value)}`);
      setResult(JSON.stringify(value));
    });
  }, [processor, surface]);

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <A2uiInstrumentSurface surface={surface} implementations={implementations} />
      <Text>{result}</Text>
    </View>
  );
}
