// Shared cross-platform Gather Components.
//
// Components are authored once in React Native primitives and rendered on the
// web through react-native-web. Any code that must differ per platform (a device
// or DOM API) is isolated behind a `.native.js` / `.web.js` module resolved by
// the bundler — never by branching inside a component.

export { palette } from './theme/palette.js';
export { tokens } from './theme/tokens.js';
export { GATHER_PALETTE } from './theme/palette.js';
export { GATHER_LAYOUT_TOKENS } from './theme/tokens.js';
export {
  REQUIRED_COLOR_KEYS,
  lightTheme,
  darkTheme,
  resolveTheme,
} from './theme/themes.js';
export { useTheme } from './theme/useTheme.js';
export {
  resolveButtonVariant,
  buttonAppearance,
  buttonHeightForVariant,
} from './theme/buttonPresentation.js';

export { Button } from './actions/Button.jsx';
export { CameraView, VideoView, CameraFrame } from './camera/index.js';

export { Panel, Heading, Helper, SectionCopy } from './primitives.jsx';
export { ImageOverlay } from './image/ImageOverlay.jsx';
export { MediaGallery } from './media/MediaGallery.jsx';
export { ResultSection, ResultRow } from './results/ResultSection.jsx';
export { MeasurementResults } from './results/MeasurementResults.jsx';
export { ClassificationResults } from './results/ClassificationResults.jsx';
export { SegmentationResult } from './results/SegmentationResult.jsx';
export { OutputReview } from './results/OutputReview.jsx';
export { InstrumentError } from './status/InstrumentError.jsx';
export { ProcessingView } from './status/ProcessingView.jsx';
