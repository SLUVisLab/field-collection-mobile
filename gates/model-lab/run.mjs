/**
 * Real segmentation inference, in a real browser, against the deployed renderer.
 *
 * The point is that this is the *app's own* executor — same preprocessing, same
 * rgbToTensor, same binaryMask, same ModelPackage-driven steps — with four
 * injected seams swapped for browser ones. If this passes, the portability bet
 * held.
 */
import { chromium } from 'playwright-core';

const RENDERER = process.env.RENDERER_ORIGIN ?? 'http://renderer.openfieldworks.localhost';
const fail = [];
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
  if (!cond) fail.push(label);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${RENDERER}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__gatherPreview?.functions?.length > 0, null, { timeout: 20000 });

const advertised = await page.evaluate(() => window.__gatherPreview.functions.map((f) => f.name));
ok('image_segment is advertised', advertised.includes('image_segment'));

// A synthetic subject: a bright disc on dark ground, so a salient-object model
// has something unambiguous to find.
const result = await page.evaluate(async () => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#101014'; context.fillRect(0, 0, size, size);
  context.fillStyle = '#f5b301';
  context.beginPath(); context.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2); context.fill();
  const uri = canvas.toDataURL('image/png');

  const image = {
    assetId: 'gate-image', uri, path: 'gate/image.png',
    width: size, height: size, mimeType: 'image/png',
    sha256: `sha256:${'0'.repeat(64)}`, orientation: null, capturedAt: new Date().toISOString(),
  };
  const segment = window.__gatherPreview.functions.find((f) => f.name === 'image_segment');
  const startedAt = performance.now();
  try {
    const output = await segment.execute({ image });
    return {
      ok: true,
      elapsedMs: Math.round(performance.now() - startedAt),
      modelId: output.model?.id, modelRevision: output.model?.revision,
      maskPath: output.mask?.path, maskSha: output.mask?.sha256,
      maskWidth: output.mask?.width, maskHeight: output.mask?.height,
      threshold: output.threshold,
      adapter: output.receipt?.runtime?.adapter,
    };
  } catch (error) {
    return { ok: false, message: String(error?.message ?? error) };
  }
});

ok('inference completed', result.ok, result.ok ? `${result.elapsedMs}ms` : result.message);
if (result.ok) {
  ok('it ran the exact declared revision', /^sha256:[a-f0-9]{64}$/.test(result.modelRevision ?? ''),
     `${result.modelId} ${String(result.modelRevision).slice(0, 22)}…`);
  ok('the receipt names the web runtime', /onnxruntime-web/.test(result.adapter ?? ''), result.adapter);
  ok('a mask asset was produced at source size', result.maskWidth === 512 && result.maskHeight === 512,
     `${result.maskWidth}x${result.maskHeight}`);
  ok('the mask has a content digest', /^sha256:[a-f0-9]{64}$/.test(result.maskSha ?? ''),
     String(result.maskSha).slice(0, 22) + '…');

  // Did it actually segment, or return an empty/full mask?
  const coverage = await page.evaluate(async (path) => {
    const url = window.__gatherPreview.files.objectUrlFor(path);
    if (!url) return { error: `no preview bytes stored at ${path}` };
    const image = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`mask image failed to load from ${url.slice(0, 32)}`));
      el.src = url;
    }).catch((error) => ({ error: error.message }));
    if (image.error) return image;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let on = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] >= 128) on += 1;
    return { coverage: on / (canvas.width * canvas.height) };
  }, result.maskPath);
  if (coverage.error) {
    ok('the mask found the subject', false, coverage.error);
  } else {
  // The disc covers ~24.6% of the frame. A real segmentation lands near it; an
  // empty or saturated mask does not.
  ok('the mask found the subject', coverage.coverage > 0.10 && coverage.coverage < 0.45,
     `${(coverage.coverage * 100).toFixed(1)}% foreground (disc is 24.6%)`);
  }
}

const real = errors.filter((e) => !/camera is not allowed/.test(e));
ok('no unexpected console errors', real.length === 0, real.slice(0, 1).join(' | '));

console.log(fail.length ? `\n${fail.length} failed` : '\nreal browser inference green');
await browser.close();
process.exit(fail.length ? 1 : 0);
