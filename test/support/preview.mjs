/**
 * The deployed renderer, and the console tolerance Gather's browser tests share.
 *
 * These tests drive the renderer the deployment actually serves rather than a
 * dev build, because the thing being proven is that the shipped artifact
 * executes — its CSP, its bundled runtime, its model bytes.
 */
import { test as base } from '@playwright/test';

export const RENDERER = process.env.RENDERER_ORIGIN ?? 'http://renderer.openfieldworks.localhost';
export const EDITOR = process.env.EDITOR_ORIGIN ?? 'http://editor.openfieldworks.localhost';

/**
 * The one console message these suites tolerate.
 *
 * The Composer frames the renderer without `allow="camera"`, which is
 * documented and deliberate. A tolerance nobody checks becomes an ignore list,
 * so this stays a single narrow pattern and anything else fails the test.
 */
const TOLERATED = [/camera is not allowed/];

export const test = base.extend({
  /** A page that fails its test on an unexpected console error or page error. */
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const allowed = [];
    /** Errors this one test expects to cause. */
    page.allowErrors = (...patterns) => allowed.push(...patterns);

    await use(page);

    const unexpected = errors.filter(
      (message) =>
        !TOLERATED.some((pattern) => pattern.test(message)) &&
        !allowed.some((pattern) => pattern.test(message))
    );
    if (unexpected.length > 0) {
      throw new Error(`The page raised ${unexpected.length} unexpected error(s):\n  ${unexpected.join('\n  ')}`);
    }
  },
});

/** Opens the renderer's preview and waits for its Capability surface. */
export const openPreview = async (page) => {
  await page.goto(`${RENDERER}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gatherPreview?.functions?.length > 0, null,
    { timeout: 60000 });
};

/**
 * Draws a bright disc on dark ground and returns it as a data URI.
 *
 * An unambiguous subject for a salient-object model, and a known area: the
 * disc covers ~24.6% of the frame, which is what makes "did it actually
 * segment, or return an empty or saturated mask" an answerable question.
 *
 * Passed to `page.evaluate`, so it runs in the browser despite living here.
 */
export const drawSyntheticSubject = () => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#101014';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#f5b301';
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
  context.fill();
  return canvas.toDataURL('image/png');
};

/** The disc's share of the frame, for comparing a mask against. */
export const SUBJECT_COVERAGE = 0.246;

export { expect } from '@playwright/test';
