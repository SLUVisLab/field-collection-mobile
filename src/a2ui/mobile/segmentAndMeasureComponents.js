import { SegmentAndMeasureCapture } from '../../components/scientific/SegmentAndMeasureViews.js';
import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS } from 'gather-catalog';

import { bindInstrumentComponent } from './InstrumentSurface.js';
import { gatherComponentImplementations } from './gatherComponents.js';
import { gatherCaptureApi } from './componentApis.js';

export { segmentAndMeasureApis } from './componentApis.js';

/**
 * Segment & Measure's own component surface.
 *
 * NOTE: Segment & Measure is the original reference composition and predates the
 * patterns established in Phase 5 (`A2UIHost`, `CameraView`). Treat it as a
 * reference, not a template. It is currently the only production authored
 * composition. The generic Gather
 * components it composes live in `gatherComponents.js`; only `GatherCapture` —
 * its bespoke capture surface — remains here.
 */

export const segmentAndMeasureImplementations = {
  ...gatherComponentImplementations,
  [GATHER_COMPONENT_IDS.capture]: {
    component: bindInstrumentComponent(gatherCaptureApi.schema, ({ statePath, context }) => (
      <SegmentAndMeasureCapture
        onCapture={(capture) =>
          context.dispatchAction({ event: { name: GATHER_ACTION_IDS.capture, context: { statePath, capture } } })
        }
      />
    )),
  },
};
