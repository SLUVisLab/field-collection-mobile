const PROCESSING_PHASES = ['persisting-capture', 'segmenting', 'measuring', 'classifying'];

export function isProcessingPhase(phase) {
  return PROCESSING_PHASES.includes(phase);
}
