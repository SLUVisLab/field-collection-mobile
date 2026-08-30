import { GATHER_ACTION_IDS, GATHER_CATALOG_ID, GATHER_COMPONENT_IDS } from './identifiers.js';

export const SEGMENT_AND_MEASURE_INSTRUMENT = Object.freeze({
  id: 'gather.segment-and-measure',
  revision: '0.1.0',
  catalogId: GATHER_CATALOG_ID,
  surfaceId: 'segment-and-measure',
  messages: Object.freeze([
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'segment-and-measure',
        catalogId: GATHER_CATALOG_ID,
        sendDataModel: true,
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'segment-and-measure',
        components: [
          { id: 'root', component: 'Column', children: ['title', 'capture', 'review'] },
          { id: 'title', component: 'Text', text: 'Segment & Measure', variant: 'h2' },
          {
            id: 'capture',
            component: GATHER_COMPONENT_IDS.capture,
            phase: { path: '/gather/phase' },
            statePath: '/gather',
          },
          {
            id: 'review',
            component: GATHER_COMPONENT_IDS.maskReview,
            phase: { path: '/gather/phase' },
            image: { path: '/gather/image' },
            segmentation: { path: '/gather/segmentation' },
            classification: { path: '/gather/classification' },
            result: { path: '/gather/result' },
            error: { path: '/gather/error' },
            statePath: '/gather',
          },
        ],
      },
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: 'segment-and-measure',
        path: '/gather',
        value: {
          phase: 'capture',
          image: null,
          segmentation: null,
          classification: null,
          result: null,
          error: null,
        },
      },
    },
  ]),
  hostActions: Object.freeze([
    GATHER_ACTION_IDS.capture,
    GATHER_ACTION_IDS.segment,
    GATHER_ACTION_IDS.classify,
    GATHER_ACTION_IDS.accept,
    GATHER_ACTION_IDS.retake,
  ]),
});
