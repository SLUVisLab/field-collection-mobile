const digest = (character) => `sha256:${character.repeat(64)}`;

const image = {
  assetId: 'fixture-image',
  uri: 'https://placehold.co/960x640/jpeg',
  path: 'fixtures/image.jpg',
  width: 960,
  height: 640,
  mimeType: 'image/jpeg',
  sha256: digest('1'),
  orientation: null,
  capturedAt: '2026-01-01T00:00:00.000Z',
};

const mask = {
  assetId: 'fixture-mask',
  uri: 'https://placehold.co/960x640/000000/00ff66.png',
  path: 'fixtures/mask.png',
  width: 960,
  height: 640,
  mimeType: 'image/png',
  sha256: digest('2'),
};

const model = { id: 'fixture-model', version: '0.1.0' };

export const fixtureCapabilities = {
  async capture() {
    return {
      uri: 'https://placehold.co/960x640/jpeg',
      path: 'fixtures/camera.jpg',
      contentType: 'image/jpeg',
      width: 960,
      height: 640,
    };
  },
  async persistScientificCapture(capture) {
    // Echo a live web-camera frame when one was captured so the reviewed image
    // is the real photo; otherwise fall back to the deterministic fixture.
    if (capture?.uri && capture.uri.startsWith('data:')) {
      return { ...image, uri: capture.uri, width: capture.width ?? image.width, height: capture.height ?? image.height, path: capture.path ?? image.path };
    }
    return image;
  },
  async segmentScientificImage({ image: input }) {
    return { image: input, model, mask, threshold: 0.5, receipt: { id: 'fixture-segmentation' }, performance: { elapsedMs: 1, phases: [] } };
  },
  async classifyScientificImage({ image: input }) {
    return {
      image: input,
      model,
      ranked: [{ label: 'fixture specimen', score: 0.99 }],
      receipt: { id: 'fixture-classification' },
      performance: { elapsedMs: 1, phases: [] },
    };
  },
  async measureScientificMask() {
    return {
      area: { value: 3200, unit: 'px2' },
      perimeter: { value: 280, unit: 'px' },
      boundingBox: { width: 80, height: 40, unit: 'px' },
      centroid: { x: 40, y: 20, unit: 'px' },
    };
  },
  async measureScientificImage() {
    return {
      color: { colorSpace: 'sRGB', channels: { red: 90, green: 120, blue: 70 } },
      sharpness: { metric: 'variance-of-laplacian', score: 42 },
    };
  },
};
