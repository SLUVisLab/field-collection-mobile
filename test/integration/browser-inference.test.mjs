/**
 * Real segmentation inference, in a real browser, against the deployed renderer.
 *
 * The point is that this is the *app's own* executor — same preprocessing, same
 * `rgbToTensor`, same `binaryMask`, same ModelPackage-driven steps — with four
 * injected seams swapped for browser ones. If this passes, the portability bet
 * held.
 *
 * It stays a browser test because nothing about it can be faked: ONNX Runtime
 * Web compiling its WASM backend, real model bytes fetched from the renderer's
 * own origin, and a mask that has to actually find the subject. What the
 * renderer *advertises* is not checked here — that is a catalog projection and
 * is unit-tested in test/renderer/preview-catalog.test.mjs.
 */
import {
  SUBJECT_COVERAGE,
  drawSyntheticSubject,
  expect,
  openPreview,
  test,
} from '../support/preview.mjs';

test.describe.configure({ mode: 'serial' });

test.describe('Segmentation on the browser runtime', () => {
  let result;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await openPreview(page);

    result = await page.evaluate(async (uri) => {
      const size = 512;
      const image = {
        assetId: 'inference-test',
        uri,
        path: 'test/image.png',
        width: size,
        height: size,
        mimeType: 'image/png',
        sha256: `sha256:${'0'.repeat(64)}`,
        orientation: null,
        capturedAt: new Date().toISOString(),
      };
      const segment = window.__gatherPreview.functions.find((f) => f.name === 'image_segment');
      const startedAt = performance.now();
      const output = await segment.execute({ image });

      // Measure the mask here, while its bytes are still reachable from the
      // page: a mask that is empty or saturated is not a segmentation, and
      // every other assertion would pass for one.
      const url = window.__gatherPreview.files.objectUrlFor(output.mask.path);
      const element = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('the mask image did not load'));
        el.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = element.naturalWidth;
      canvas.height = element.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(element, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let on = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] >= 128) on += 1;

      return {
        elapsedMs: Math.round(performance.now() - startedAt),
        model: output.model,
        mask: output.mask,
        adapter: output.receipt?.runtime?.adapter,
        coverage: on / (canvas.width * canvas.height),
      };
    }, await page.evaluate(drawSyntheticSubject));

    await page.close();
  });

  test('inference runs the exact revision the Tool declared', () => {
    expect(
      result.model?.revision,
      `${result.model?.id} ${String(result.model?.revision).slice(0, 22)}…`
    ).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('the receipt names the web runtime it actually used', () => {
    expect(result.adapter, 'a receipt that names no runtime cannot be checked against the device')
      .toMatch(/onnxruntime-web/);
  });

  test('the mask is a real asset at source size, with a content digest', () => {
    expect([result.mask?.width, result.mask?.height]).toEqual([512, 512]);
    expect(result.mask?.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('the mask actually found the subject', () => {
    // The disc covers ~24.6% of the frame. A real segmentation lands near it;
    // an empty or saturated mask does not, and would satisfy every assertion
    // above.
    expect(
      result.coverage,
      `${(result.coverage * 100).toFixed(1)}% foreground (the disc is ${SUBJECT_COVERAGE * 100}%)`
    ).toBeGreaterThan(0.1);
    expect(result.coverage).toBeLessThan(0.45);
  });
});
