/**
 * The copyable authoring examples, executed.
 *
 * A Function browser that shows an author how to call a Capability is making a
 * promise, and the failure mode is not that the example looks wrong — it is
 * that it stays plausible while the contract moves, and someone copies
 * something the runtime refuses.
 *
 * So every example the gallery can show is run here, through the real web
 * Capability runtime, on a deterministic fixture, and its result is validated
 * against the definition's own output schema:
 *
 * ```text
 * CapabilityDefinition + authoring metadata
 *   → generated usage JSON
 *   → resolved against a fixture data model
 *   → the real web Capability runtime
 *   → output, validated against the real declared schema
 * ```
 *
 * The shape of the example is checked without a browser in
 * packages/gather-capabilities/test/authoring-metadata.test.mjs. This is the
 * half that needs one: whether the thing actually runs.
 *
 * The fixture is a bright disc on dark ground, 512x512, radius 0.28 x 512. Its
 * geometry is known, so "did it run" and "did it produce the right answer" are
 * separate questions with separate answers.
 */
import assert from 'node:assert/strict';

import {
  CAPABILITY_AUTHORING_METADATA,
  CAPABILITY_DEFINITIONS,
  functionNameFor,
  usageExampleFor,
} from 'gather-capabilities';

import { expect, openPreview, test } from '../support/preview.mjs';

const SIZE = 512;
const RADIUS = SIZE * 0.28;

/** What the fixture's geometry says the answers must be. */
const EXPECTED = {
  area: Math.PI * RADIUS ** 2,
  perimeter: 2 * Math.PI * RADIUS,
  boundingSide: RADIUS * 2,
  centroid: SIZE / 2,
};

/** Within a few percent: rasterising a circle is not the same as computing one. */
const near = (actual, expected, tolerance = 0.05) =>
  Math.abs(actual - expected) / expected <= tolerance;

const examples = CAPABILITY_DEFINITIONS.map((definition) => {
  const functionName = functionNameFor(definition.id);
  return {
    definition,
    functionName,
    usage: usageExampleFor({
      functionName,
      metadata: CAPABILITY_AUTHORING_METADATA[functionName],
    }),
  };
});

test.describe.configure({ mode: 'serial' });

test.describe('Every generated authoring example', () => {
  /** functionName -> what the runtime returned, or how it refused. */
  let results;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await openPreview(page);

    results = await page.evaluate(
      async ([calls, size, radius]) => {
        /** An asset in the shape the runtime hands around. */
        const assetFrom = (canvas, name) => ({
          assetId: name,
          uri: canvas.toDataURL('image/png'),
          path: `fixture/${name}.png`,
          width: canvas.width,
          height: canvas.height,
          mimeType: 'image/png',
          sha256: `sha256:${'0'.repeat(64)}`,
          orientation: null,
          capturedAt: '2026-01-01T00:00:00.000Z',
        });

        const draw = (paint) => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          paint(canvas.getContext('2d'));
          return canvas;
        };

        // The subject, and a mask of exactly that subject. The mask is drawn
        // rather than segmented so the expected answers are the circle's, not
        // whatever a model happened to find.
        const image = assetFrom(
          draw((context) => {
            context.fillStyle = '#101014';
            context.fillRect(0, 0, size, size);
            context.fillStyle = '#f5b301';
            context.beginPath();
            context.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
            context.fill();
          }),
          'image'
        );
        const mask = assetFrom(
          draw((context) => {
            context.fillStyle = '#000000';
            context.fillRect(0, 0, size, size);
            context.fillStyle = '#ffffff';
            context.beginPath();
            context.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
            context.fill();
          }),
          'mask'
        );

        /** The fixture data model the examples' paths point into. */
        const model = { '/working/image': image, '/working/mask': mask };

        const resolve = (value) =>
          value && typeof value === 'object' && typeof value.path === 'string'
            ? model[value.path]
            : value;

        const out = {};
        for (const { functionName, args } of calls) {
          const fn = window.__gatherPreview.functions.find((f) => f.name === functionName);
          if (!fn) {
            out[functionName] = { ran: false, why: 'the runtime advertises no such function' };
            continue;
          }
          const resolved = Object.fromEntries(
            Object.entries(args).map(([name, value]) => [name, resolve(value)])
          );
          const unresolved = Object.entries(resolved)
            .filter(([, value]) => value === undefined)
            .map(([name]) => name);
          if (unresolved.length > 0) {
            out[functionName] = {
              ran: false,
              why: `the example points at ${unresolved.join(', ')}, which the fixture has no value for`,
            };
            continue;
          }
          try {
            out[functionName] = { ran: true, output: await fn.execute(resolved) };
          } catch (error) {
            out[functionName] = { ran: false, why: `${error.code ?? error.name}: ${error.message}` };
          }
        }
        return out;
      },
      [
        examples.map(({ functionName, usage }) => ({
          functionName,
          args: usage.functionCall.args,
        })),
        SIZE,
        RADIUS,
      ]
    );

    await page.close();
  });

  for (const { definition, functionName } of examples) {
    test(`${functionName} runs as written`, () => {
      const result = results[functionName];
      expect(result.ran, `${functionName} did not run — ${result.why}`).toBe(true);
    });

    test(`${functionName} returns what its definition declares`, () => {
      const result = results[functionName];
      expect(result.ran, `${functionName} did not run — ${result.why}`).toBe(true);

      // The definition's own schema, not a restatement of it. An example whose
      // result the contract would reject is not an example of anything.
      const parsed = definition.output.safeParse(result.output);
      assert.ok(
        parsed.success,
        `${functionName} returned something its own output schema refuses:\n` +
          JSON.stringify(parsed.error?.issues ?? [], null, 2).slice(0, 400)
      );
    });
  }

  test('the measurements are the fixture\'s real geometry, not merely well-formed', () => {
    // A capability that returned a plausible zero would satisfy every schema
    // above. These are the numbers the circle actually has.
    const area = results.measure_area.output;
    expect(
      near(area.value, EXPECTED.area),
      `${area.value} ${area.unit}, expected about ${Math.round(EXPECTED.area)}`
    ).toBe(true);

    // A traced perimeter runs systematically longer than the ideal one: the
    // contour follows pixel edges, and a staircase around a circle is longer
    // than the circle. ~5-6% over at this radius is the shape of that effect,
    // not slop — so the bound is wider here and still one-sided enough to
    // catch a perimeter that came back as zero, as the diameter, or as the
    // frame.
    const perimeter = results.measure_perimeter.output;
    expect(
      near(perimeter.value, EXPECTED.perimeter, 0.1),
      `${perimeter.value} ${perimeter.unit}, expected about ${Math.round(EXPECTED.perimeter)}`
    ).toBe(true);
    expect(
      perimeter.value >= EXPECTED.perimeter,
      'a traced perimeter is never shorter than the ideal one'
    ).toBe(true);

    const box = results.measure_boundingBox.output;
    expect(near(box.width, EXPECTED.boundingSide), `width ${box.width}`).toBe(true);
    expect(near(box.height, EXPECTED.boundingSide), `height ${box.height}`).toBe(true);

    const centroid = results.measure_centroid.output;
    expect(near(centroid.x, EXPECTED.centroid), `x ${centroid.x}`).toBe(true);
    expect(near(centroid.y, EXPECTED.centroid), `y ${centroid.y}`).toBe(true);
  });

  test('a model-backed example runs on the default it teaches by omission', () => {
    // The example passes no modelRef. That has to be enough, or the thing the
    // gallery shows first is the thing that does not work.
    for (const name of ['image_segment', 'image_classify']) {
      const result = results[name];
      expect(result.ran, `${name} did not run — ${result.why}`).toBe(true);
      expect(
        result.output.model?.revision,
        `${name} ran without reporting which model it used`
      ).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });
});
