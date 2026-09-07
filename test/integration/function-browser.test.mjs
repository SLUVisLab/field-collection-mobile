/**
 * The Composer's Function browser, driven in a real browser.
 *
 * Components are the nouns of an authored Tool and Functions are the verbs, and
 * the upstream gallery showed only the nouns — an author could see what a Tool
 * would look like and not what it could do. Our patch adds the other half.
 *
 * Everything Gather-specific arrives as Catalog *data*: two `x-host-*`
 * annotations the renderer attaches, which the patched gallery renders
 * generically. This is an integration test because the subject is a patched
 * upstream build talking to a live catalog over the bridge — neither half can
 * be stubbed without testing something else.
 */
import {
  CAPABILITY_AUTHORING_METADATA,
  usageExampleFor,
} from 'gather-capabilities';

import { expect, test } from '../support/preview.mjs';
import { EDITOR, RENDERER } from '../support/bridgeHost.mjs';

/** Every Capability Gather exposes as authorable. */
const CAPABILITIES = [
  'image_segment',
  'image_classify',
  'measure_area',
  'measure_perimeter',
  'measure_boundingBox',
  'measure_centroid',
  'measure_color',
  'measure_sharpness',
];

/** Host functions are ordinary Functions here — the gallery does not special-case them. */
const HOST_FUNCTIONS = ['gather_persistAsset', 'gather_completeComposition'];

const galleryItems = (page) =>
  page.$$eval('.component-nav-item', (items) => items.map((el) => el.textContent.trim()));

const categoryHeadings = (page) =>
  page.$$eval('.category-header', (items) => items.map((el) => el.textContent.trim()));

test.describe.configure({ mode: 'serial' });

test.describe('The Function browser', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    page = await context.newPage();

    // Entered the way a researcher does: load the app with a renderer, then use
    // the navigation rail. Going straight to /functions works but arrives
    // before any catalog is connected, which tests the router rather than the
    // browser.
    await page.goto(`${EDITOR}/?renderer=${encodeURIComponent(RENDERER)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('a[mat-list-item]', { timeout: 60000 });

    // The renderer answers GET_CATALOG once it has booted, so its device frame
    // appearing is the last observable step before the catalog exists. The
    // iframe element alone is not enough — it exists well before the handshake.
    await expect
      .poll(
        async () => {
          const frame = page.frames().find((f) => f.url().startsWith(RENDERER));
          return Boolean(frame && (await frame.$('.renderer-shell').catch(() => null)));
        },
        { timeout: 60000 }
      )
      .toBe(true);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('the navigation rail offers Functions, and no longer offers A2A testing', async () => {
    const rail = await page.$$eval('a[mat-list-item]', (links) =>
      links.map((link) => link.getAttribute('aria-label'))
    );

    expect(rail, rail.join(' | ')).toContain('Functions Gallery');
    expect(rail, 'A2A agent testing is not relevant to authoring a Tool').not.toContain(
      'A2A Agent Testing'
    );
  });

  test('every Capability and host function is listed', async () => {
    await page.click('a[aria-label="Functions Gallery"]');
    // The catalog arrives over the bridge, so the list appears when it does.
    await expect.poll(() => galleryItems(page).then((i) => i.length), { timeout: 60000 })
      .toBeGreaterThan(0);

    const listed = await galleryItems(page);
    for (const name of [...CAPABILITIES, ...HOST_FUNCTIONS]) {
      expect(listed, `${name} is not listed`).toContain(name);
    }
  });

  test('categories come from x-host-category rather than from guessing', async () => {
    const headings = await categoryHeadings(page);
    for (const heading of ['Measurement', 'Image', 'Tool lifecycle']) {
      expect(headings, headings.join(' | ')).toContain(heading);
    }
  });

  test('a function detail shows real, parseable usage', async () => {
    await page.click('.component-nav-item:has-text("measure_area")');
    await page.waitForFunction(
      () => document.querySelector('.component-title')?.textContent.trim() === 'measure_area',
      null,
      { timeout: 30000 }
    );

    const detail = await page.evaluate(() => ({
      description: document.querySelector('.component-description')?.textContent.trim() ?? '',
      usage: document.querySelector('.usage-code')?.textContent ?? '',
      params: [...document.querySelectorAll('.prop-name')].map((el) => el.textContent.trim()),
      types: [...document.querySelectorAll('.prop-type')].map((el) => el.textContent.trim()),
    }));

    expect(detail.description, detail.description.slice(0, 70)).toMatch(/area of the masked region/i);

    // Usage must be the host's actual JSON, and must parse — a teaching surface
    // that shows something unrunnable teaches the wrong thing.
    const parsed = JSON.parse(detail.usage);
    expect(parsed.functionCall.call).toBe('measure_area');
    expect(parsed.functionCall.args.mask.path).toBe('/working/mask');
    expect(parsed.resultPath).toBe('/working/area');

    expect(detail.params, detail.params.join(', ')).toContain('mask');
    // `measure.area` returns a Quantity — `{ value, unit }` — so the catalog's
    // returnType is 'object'. An earlier version asserted 'decimal', which was
    // the illustrative type from a design note rather than the contract's.
    expect(detail.types, JSON.stringify(detail.types)).toContain('object');
  });

  test('what the gallery shows is what the generator generated', async () => {
    // The loop this closes: the same object that
    // test/integration/usage-examples.test.mjs executes against the real
    // runtime is the one an author copies out of this panel. Without this,
    // both halves can be green while the gallery renders something else.
    for (const name of ['measure_area', 'image_segment']) {
      await page.click(`.component-nav-item:has-text("${name}")`);
      await page.waitForFunction(
        (wanted) => document.querySelector('.component-title')?.textContent.trim() === wanted,
        name,
        { timeout: 30000 }
      );

      const shown = await page.evaluate(
        () => document.querySelector('.usage-code')?.textContent ?? ''
      );
      const generated = usageExampleFor({
        functionName: name,
        metadata: CAPABILITY_AUTHORING_METADATA[name],
      });

      expect(JSON.parse(shown), `${name}'s panel shows something the generator did not make`)
        .toEqual(generated);
    }
  });

  test('the copy button copies exactly what is shown', async () => {
    const shown = await page.evaluate(
      () => document.querySelector('.usage-code')?.textContent ?? ''
    );
    await page.click('.copy-button');

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard.trim()).toBe(shown.trim());
  });

  test('a model-backed Capability teaches the default by omitting modelRef', async () => {
    await page.click('.component-nav-item:has-text("image_segment")');
    await page.waitForFunction(
      () => document.querySelector('.component-title')?.textContent.trim() === 'image_segment',
      null,
      { timeout: 30000 }
    );

    const usage = await page.evaluate(() => document.querySelector('.usage-code')?.textContent ?? '');
    expect(usage).toContain('image_segment');
    expect(
      usage,
      'omission is what selects the distribution default — a sentinel would be a second answer'
    ).not.toContain('modelRef');
  });

  test('a Capability is shown as one, and named by its own id', async () => {
    await page.click('.component-nav-item:has-text("measure_area")');
    await page.waitForFunction(
      () => document.querySelector('.component-title')?.textContent.trim() === 'measure_area',
      null,
      { timeout: 30000 }
    );

    const detail = await page.evaluate(() => ({
      kind: document.querySelector('.function-kind')?.textContent.trim() ?? '',
      dataKind: document.querySelector('.function-kind')?.dataset.kind ?? '',
      semantic: document.querySelector('.function-semantic')?.textContent.trim() ?? '',
    }));

    expect(detail.dataKind).toBe('capability');
    expect(detail.kind).toBe('Capability');
    expect(detail.semantic, 'the id a receipt and a manifest use').toBe('measure.area');
  });

  test('a host function is not dressed up as a Capability', async () => {
    await page.click('.component-nav-item:has-text("gather_persistAsset")');
    await page.waitForFunction(
      () => document.querySelector('.component-title')?.textContent.trim() === 'gather_persistAsset',
      null,
      { timeout: 30000 }
    );

    const detail = await page.evaluate(() => ({
      kind: document.querySelector('.function-kind')?.dataset.kind ?? '',
      semantic: document.querySelector('.function-semantic') != null,
      hasModelCard: [...document.querySelectorAll('mat-card-title')].some(
        (title) => title.textContent.trim() === 'Model'
      ),
    }));

    expect(detail.kind).toBe('host');
    expect(detail.semantic, 'a host function has no Capability id to show').toBe(false);
    expect(detail.hasModelCard, 'a host function runs no model').toBe(false);
  });

  test('a model-backed Capability shows the models it accepts, and lets one be copied', async () => {
    await page.click('.component-nav-item:has-text("image_segment")');
    await page.waitForFunction(
      () => document.querySelector('.function-kind') != null &&
        document.querySelector('.component-title')?.textContent.trim() === 'image_segment',
      null,
      { timeout: 30000 }
    );

    const model = await page.evaluate(() => ({
      profiles: document.querySelector('.model-profiles')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
      names: [...document.querySelectorAll('.model-name')].map((el) => el.textContent.trim()),
      defaults: document.querySelectorAll('.model-default').length,
      shownRef: document.querySelector('.model-ref-code')?.textContent ?? '',
    }));

    expect(model.profiles, 'the accepted profile is what makes a model compatible at all')
      .toContain('segmentation.binary.v1');
    expect(model.names.length, 'no compatible model listed').toBeGreaterThan(0);
    expect(model.defaults, 'the model a Tool gets by omitting modelRef is marked').toBeGreaterThan(0);

    // Verbatim: a revision is a content digest and cannot be retyped from a
    // truncated display, which is the only reason the copy button exists.
    await page.click('.model-copy');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(clipboard).revision).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.parse(clipboard)).toEqual(JSON.parse(model.shownRef));
  });

  test('the Model card offers no way to change the model', async () => {
    await page.click('.component-nav-item:has-text("image_segment")');
    await page.waitForFunction(
      () => document.querySelector('.component-title')?.textContent.trim() === 'image_segment',
      null,
      { timeout: 30000 }
    );

    // Selection is a mutation of the document being authored, and this gallery
    // does not own that document. Read-only is the architecture, not an
    // unfinished feature — a select or an Apply here would be a second, silent
    // authority over model choice.
    const affordances = await page.evaluate(() => {
      const card = [...document.querySelectorAll('mat-card')].find((element) =>
        element.querySelector('mat-card-title')?.textContent.trim() === 'Model'
      );
      return {
        selects: card?.querySelectorAll('select, mat-select').length ?? 0,
        buttons: [...(card?.querySelectorAll('button') ?? [])].map((b) =>
          (b.getAttribute('aria-label') ?? b.textContent ?? '').trim()
        ),
      };
    });

    expect(affordances.selects).toBe(0);
    for (const label of affordances.buttons) {
      expect(label, `"${label}" is not a copy affordance`).toMatch(/^Copy /);
    }
  });

  test('the gallery is a reference surface: no Tool state, and no way to change one', async () => {
    // The boundary this whole surface rests on. An earlier revision rendered
    // the embedding host's current document state here — which models *that*
    // Tool used, its occurrences, its bindings — and the gallery quietly became
    // a second authoring surface. It was removed, and this is what keeps it
    // removed.
    //
    // What a Capability *can* use belongs here. What a particular Tool *does*
    // use belongs to the application that owns that Tool.
    await page.click('.component-nav-item:has-text("image_segment")');
    await page.waitForFunction(
      () => document.querySelector('.component-title')?.textContent.trim() === 'image_segment',
      null,
      { timeout: 30000 }
    );

    const detail = await page.evaluate(() => ({
      text: document.querySelector('.details-panel')?.innerText ?? '',
      toolState: [
        '[data-testid="host-model-usage"]',
        '.tool-usage',
        '.tool-selection',
      ].flatMap((selector) => [...document.querySelectorAll(selector)]).length,
      inputs: document.querySelectorAll('.details-panel select, .details-panel mat-select').length,
      buttons: [...document.querySelectorAll('.details-panel button')].map(
        (button) => (button.getAttribute('aria-label') ?? button.textContent ?? '').trim()
      ),
    }));

    expect(detail.toolState, 'no Tool-scoped section may render here').toBe(0);
    for (const phrase of ['Used in this Tool', 'occurrence', 'Shared by', 'Source:', 'Use in current Tool']) {
      expect(detail.text, `"${phrase}" is Tool state and does not belong in a catalog`).not.toContain(phrase);
    }

    // Every affordance is a copy. Nothing here applies, selects, or imports.
    expect(detail.inputs).toBe(0);
    for (const label of detail.buttons) {
      expect(label, `"${label}" is not a copy affordance`).toMatch(/^Copy /);
    }
  });

  test('browsing the gallery sends the embedding host nothing', async () => {
    // Reference browsing is not authoring. A host watching this frame should
    // see no request to change anything, whatever the researcher clicks.
    await page.evaluate(() => {
      window.__hostMessages = [];
      const original = window.parent.postMessage.bind(window.parent);
      window.parent.postMessage = (message, ...rest) => {
        window.__hostMessages.push(message?.type ?? String(message));
        return original(message, ...rest);
      };
    });

    for (const name of ['measure_area', 'image_segment', 'gather_persistAsset']) {
      await page.click(`.component-nav-item:has-text("${name}")`);
      await page.waitForFunction(
        (wanted) => document.querySelector('.component-title')?.textContent.trim() === wanted,
        name,
        { timeout: 30000 }
      );
    }

    const sent = await page.evaluate(() => window.__hostMessages);
    const mutations = sent.filter((type) => /HOST_ACTION|SET_DOCUMENT|APPLY|SELECT/i.test(type));
    expect(mutations, `the gallery asked the host to change something: ${sent.join(', ')}`).toEqual([]);
  });

  test('the Components gallery is unchanged, and separate', async () => {
    await page.click('a[aria-label="Components Gallery"]');
    await expect
      .poll(() => galleryItems(page), { timeout: 60000 })
      .toContain('CameraView');

    const listed = await galleryItems(page);
    const headings = await categoryHeadings(page);

    expect(headings.some((heading) => /capture/i.test(heading)), headings.join(' | ')).toBe(true);
    expect(
      listed,
      'the two galleries are separate destinations, not one list'
    ).not.toContain('measure_area');
  });
});
