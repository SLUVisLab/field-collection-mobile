/**
 * The bridge between the pinned upstream A2UI Composer and Gather's renderer.
 *
 * Two origins, a sandboxed iframe, and the documented five-message protocol.
 * The failure this exists for looks like nothing at all from the server: the
 * renderer serves 200 to everything and the browser silently refuses to frame
 * it, so the handshake never happens and the console is the only witness. That
 * is why the catalog handshake is checked first and separately — everything
 * below it is meaningless without one.
 *
 * What the catalog *contains* is derived from the canonical Tool rather than
 * restated here, so this cannot pass while the renderer advertises functions
 * the shipped Tool does not use.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { categorizedComponents, SEGMENT_AND_MEASURE_INSTRUMENT } from 'gather-catalog';

import { expect, test } from '../support/preview.mjs';
import { RENDERER, instrumentText, openBridgeHost } from '../support/bridgeHost.mjs';

const SURFACE = SEGMENT_AND_MEASURE_INSTRUMENT.messages[0].createSurface.surfaceId;

const CANONICAL_TOOL = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json',
        import.meta.url
      )
    ),
    'utf8'
  )
);

/** The functions the shipped Tool actually calls. */
const TOOL_CALLS = [
  ...new Set(
    CANONICAL_TOOL.messages
      .flatMap((message) => message.updateComponents?.components ?? [])
      .map((component) => component.action?.functionCall?.call)
      .filter(Boolean)
  ),
];

const entries = (raw) => (Array.isArray(raw) ? raw : Object.values(raw ?? {}));
const namesOf = (raw) =>
  (Array.isArray(raw) ? raw.map((c) => c.name ?? c.id) : Object.keys(raw ?? {})).filter(Boolean);

test.describe.configure({ mode: 'serial' });

test.describe('The Composer bridge', () => {
  let page;
  let catalog;
  let frame;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await openBridgeHost(page);

    try {
      await page.waitForFunction(() => window.__result.catalog, null, { timeout: 60000 });
    } catch {
      throw new Error(
        'The renderer never completed the catalog handshake. If the browser refused to frame ' +
          'it, add this Composer origin to RENDERER_FRAME_ANCESTORS and redeploy the renderer — ' +
          'the refusal appears in the console and nowhere else.'
      );
    }
    catalog = await page.evaluate(() => window.__result.catalog);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('the catalog handshake advertises Gather components', () => {
    const names = namesOf(catalog.components ?? catalog.catalog?.components);
    expect(names.length, 'an empty catalog is a handshake that did not happen').toBeGreaterThan(0);
    expect(names.filter((name) => /^Gather|^Flow$/.test(name)).join(', ')).not.toBe('');
  });

  test('every function the shipped Tool calls is advertised', () => {
    const advertised = new Set(namesOf(catalog.functions ?? catalog.catalog?.functions));
    const missing = TOOL_CALLS.filter((call) => !advertised.has(call));

    // The renderer advertised only upstream's Basic Catalog until 2026-09-05,
    // so the Composer could not author the Tool the device was already running.
    expect(missing, `missing ${missing.join(', ')}`).toEqual([]);
  });

  test('the ModelRef the Tool pins is discoverable from the handshake', () => {
    const authored = CANONICAL_TOOL.messages.find((m) => m.updateDataModel)?.updateDataModel.value
      .modelRef.revision;
    const segment = entries(catalog.functions ?? catalog.catalog?.functions).find(
      (fn) => fn?.name === 'image_segment'
    );
    const offered = segment?.parameters?.properties?.modelRef?.properties?.revision?.enum ?? [];

    // The Tool pins a revision; the advertised schema must offer that same
    // revision, or an agent authoring against the catalog can only guess.
    expect(offered, `${offered.length} revision(s) offered`).toContain(authored);
  });

  test('Gather\'s component categories travel in the payload', () => {
    const declared = new Set(
      entries(catalog.components ?? catalog.catalog?.components)
        .map((entry) => entry?.['x-host-category'])
        .filter(Boolean)
    );
    // Derived from gather-catalog rather than restated, so a category added
    // there is asserted here without editing this file.
    const expected = new Set(Object.values(categorizedComponents()));

    expect([...declared].sort()).toEqual([...expected].sort());
  });

  test('a Capability is distinguishable from a host function, and names itself', () => {
    const functions = entries(catalog.functions ?? catalog.catalog?.functions);
    const byName = new Map(functions.map((fn) => [fn.name, fn]));

    // A browser cannot tell these apart from a name, and presenting a host
    // function as a semantic capability misrepresents the vocabulary.
    expect(byName.get('measure_area')?.['x-host-kind']).toBe('capability');
    expect(byName.get('gather_persistAsset')?.['x-host-kind']).toBe('host');

    // `measure_area` is what a document calls; `measure.area` is what the
    // contract, the manifest and a receipt use.
    expect(byName.get('measure_area')?.['x-host-semantic']).toBe('measure.area');
    expect(
      byName.get('gather_persistAsset')?.['x-host-semantic'],
      'a host function has no Capability id to give'
    ).toBeUndefined();
  });

  test('a model-backed Capability carries the models it accepts', () => {
    const functions = entries(catalog.functions ?? catalog.catalog?.functions);
    const segment = functions.find((fn) => fn?.name === 'image_segment');
    const area = functions.find((fn) => fn?.name === 'measure_area');

    const models = segment?.['x-host-models'];
    expect(models?.profiles, 'the accepted profile is what makes a model compatible at all')
      .toContain('segmentation.binary.v1');
    expect(models?.compatible?.length, 'no compatible model is advertised').toBeGreaterThan(0);

    const [first] = models.compatible;
    expect(first.displayName).toBeTruthy();
    // Carried whole: a revision is a content digest, and a partial one is
    // something an author cannot use.
    expect(first.modelRef?.revision).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(
      models.compatible.some((model) => model.isDefault),
      'nothing is marked as the default the Tool would get by omitting modelRef'
    ).toBe(true);

    expect(
      area?.['x-host-models'],
      'a Capability that runs no model must not carry an empty model section'
    ).toBeUndefined();
  });

  test('RENDER_A2UI renders the instrument into a device that fits its pane', async () => {
    await page.evaluate(
      (messages) => window.__send({ type: 'RENDER_A2UI', payload: messages }),
      SEGMENT_AND_MEASURE_INSTRUMENT.messages
    );
    frame = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(RENDERER));
    await frame.waitForFunction(
      () => (document.querySelector('.gather-instrument-content')?.innerText.trim() ?? '').length > 0,
      null,
      { timeout: 60000 }
    );

    expect(await instrumentText(frame)).not.toBe('');

    // The device frame was once drawn at a fixed zoom and clipped by 186px in a
    // 1600x1000 Composer window, hiding the bottom of the phone — which is
    // where a Tool's Accept button lives.
    const fit = await frame.evaluate(() => {
      const element = document.querySelector('.renderer-stage')?.firstElementChild;
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        clipped: Math.max(0, Math.round(rect.bottom - document.documentElement.clientHeight)),
        height: Math.round(rect.height),
      };
    });
    expect(fit, 'no renderer stage found').not.toBeNull();
    expect(fit.clipped, `${fit.height}px tall, ${fit.clipped}px clipped`).toBe(0);
  });

  test('DATA_MODEL_CHANGE selects another view', async () => {
    const before = await instrumentText(frame);

    await page.evaluate(
      ([surfaceId, value]) =>
        window.__send({
          type: 'DATA_MODEL_CHANGE',
          payload: { updateDataModel: { surfaceId, path: '/gather/status', value } },
        }),
      [SURFACE, 'error']
    );

    await expect.poll(() => instrumentText(frame)).not.toBe(before);
    expect(await instrumentText(frame)).not.toBe('');
  });

  test('an action taken in the device comes back as SEND_TO_SERVER', async () => {
    await page.evaluate(
      ([surfaceId, value]) =>
        window.__send({
          type: 'DATA_MODEL_CHANGE',
          payload: { updateDataModel: { surfaceId, path: '/gather/status', value } },
        }),
      [SURFACE, 'capture']
    );

    // Acquired through the sample-image input rather than the shutter. This is
    // about the protocol, not about cameras, and a shutter with no camera
    // behind it is now refused at source rather than dispatching an action
    // carrying no capture at all.
    await frame.waitForSelector('input[type=file]', { state: 'attached', timeout: 60000 });
    await frame.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      context.fillStyle = '#3f7d20';
      context.fillRect(0, 0, 64, 64);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const input = document.querySelector('input[type=file]');
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'bridge-sample.png', { type: 'image/png' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect
      .poll(() => page.evaluate(() => window.__result.actions.length), { timeout: 60000 })
      .toBeGreaterThan(0);
  });
});
