import { useMemo, useRef } from 'react';
import { Catalog } from '@a2ui/web_core/v0_9/catalog';
import { MessageProcessor } from '@a2ui/web_core/v0_9/processor';
import { ColumnApi, TextApi } from '@a2ui/web_core/v0_9/basic_catalog';

import { useGather } from '../../context/GatherContext.js';
import { createCapabilityActionHandler } from '../capabilityActionAdapter.js';
import { A2uiInstrumentSurface, mobileBasicImplementations } from './InstrumentSurface.js';
import { gatherCaptureApi, maskReviewApi, segmentAndMeasureImplementations } from './segmentAndMeasureComponents.js';
import { GATHER_CATALOG_ID, SEGMENT_AND_MEASURE_INSTRUMENT } from 'gather-catalog';

const catalog = new Catalog(GATHER_CATALOG_ID, [ColumnApi, TextApi, gatherCaptureApi, maskReviewApi]);
const implementations = { ...mobileBasicImplementations, ...segmentAndMeasureImplementations };

export function SegmentAndMeasureInstrument() {
  const { actions } = useGather();
  const handlerRef = useRef(null);
  const processor = useMemo(() => {
    const next = new MessageProcessor([catalog], (action) => handlerRef.current?.(action));
    next.processMessages(SEGMENT_AND_MEASURE_INSTRUMENT.messages);
    return next;
  }, []);
  handlerRef.current = createCapabilityActionHandler({ processor, capabilities: actions });
  const surface = processor.model.getSurface(SEGMENT_AND_MEASURE_INSTRUMENT.surfaceId);
  return <A2uiInstrumentSurface surface={surface} implementations={implementations} />;
}
