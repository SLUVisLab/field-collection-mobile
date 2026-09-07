import { Screen } from '../../components/Screen.js';
import { SegmentAndMeasureInstrument } from '../../a2ui/mobile/SegmentAndMeasureInstrument.js';

export function SegmentAndMeasure() {
  return (
    <Screen screenId="segment-measure" title="Segment & Measure" subtitle="Generic image measurements">
      <SegmentAndMeasureInstrument />
    </Screen>
  );
}
