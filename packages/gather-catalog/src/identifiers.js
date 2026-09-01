export const GATHER_CATALOG_ID = 'https://gather.slu.edu/a2ui/catalogs/v0.1.json';
export const GATHER_CATALOG_REVISION = '0.1.0';

export const GATHER_COMPONENT_IDS = Object.freeze({
  capture: 'GatherCapture',
  imageOverlay: 'ImageOverlay',
  outputReview: 'OutputReview',
  processingView: 'ProcessingView',
  instrumentError: 'InstrumentError',
});

export const GATHER_ACTION_IDS = Object.freeze({
  capture: 'gather.capture',
  segment: 'gather.segment',
  classify: 'gather.classify',
  accept: 'gather.accept',
  retake: 'gather.retake',
  advance: 'gather.advance',
  back: 'gather.back',
});
