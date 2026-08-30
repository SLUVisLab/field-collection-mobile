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

export { ActionButton } from './components/actions/ActionButton.jsx';
export { CaptureView } from './components/capture/CaptureView.jsx';

export { Panel, Heading, Helper, SectionCopy } from './components/primitives.jsx';
export { MaskReview } from './components/image/MaskReview.jsx';
export { ResultSection, ResultRow } from './components/results/ResultSection.jsx';
export { MeasurementResults } from './components/results/MeasurementResults.jsx';
export { ClassificationResults } from './components/results/ClassificationResults.jsx';
export { SegmentationResult } from './components/results/SegmentationResult.jsx';
export { OutputReview } from './components/results/OutputReview.jsx';
export { InstrumentError } from './components/status/InstrumentError.jsx';
export { ProcessingView } from './components/status/ProcessingView.jsx';
export { isProcessingPhase } from './components/status/processingPhases.js';
