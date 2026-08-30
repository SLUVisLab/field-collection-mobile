/**
 * Applies a Composer render batch to an upstream A2UI MessageProcessor.
 *
 * Composer re-sends full render batches that re-declare `createSurface` for
 * surfaces that already exist, and upstream `processCreateSurfaceMessage`
 * throws on duplicates. Delete any surface this batch is about to (re)create so
 * renders stay idempotent, then process the batch.
 */
export function applyRenderBatch(processor, payload) {
  if (!Array.isArray(payload)) return;
  for (const entry of payload) {
    const surfaceId = entry?.createSurface?.surfaceId;
    if (surfaceId && processor.model.getSurface(surfaceId)) {
      processor.model.deleteSurface(surfaceId);
    }
  }
  processor.processMessages(payload);
}
