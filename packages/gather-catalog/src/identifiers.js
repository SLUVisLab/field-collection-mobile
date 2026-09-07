export const GATHER_CATALOG_ID = 'https://gather.slu.edu/a2ui/catalogs/v0.1.json';
export const GATHER_CATALOG_REVISION = '0.1.0';

export const GATHER_COMPONENT_IDS = Object.freeze({
  capture: 'GatherCapture',
  cameraView: 'CameraView',
  mediaGallery: 'MediaGallery',
  multiImageCapture: 'MultiImageCapture',
  flow: 'Flow',
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
  submit: 'gather.submit',
  // Collection editing. A Component's action semantics ship with the Component,
  // so these are fixed vocabulary rather than per-composition invention.
  mediaCaptured: 'gather.mediaCaptured',
  mediaChanged: 'gather.mediaChanged',
  mediaSelected: 'gather.mediaSelected',
  mediaDone: 'gather.mediaDone',
  mediaBack: 'gather.mediaBack',
});
