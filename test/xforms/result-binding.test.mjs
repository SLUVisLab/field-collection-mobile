import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ResultBindingError,
  createResultFieldWriter,
  readResultValue,
  toXFormsValue,
} from '../../src/xforms/resultBinding.js';
import { createSegmentAndMeasureResult } from '../../src/scientific/workflows/segmentAndMeasure.js';

const digest = (character) => `sha256:${character.repeat(64)}`;

const image = {
  assetId: 'image-1',
  uri: 'file:///var/mobile/photo.jpg',
  path: 'projects/p/media/photo.jpg',
  width: 960,
  height: 640,
  mimeType: 'image/jpeg',
  sha256: digest('a'),
  orientation: null,
  capturedAt: '2026-09-02T00:00:00.000Z',
};
const mask = { assetId: 'mask-1', uri: 'file:///m.png', path: 'm.png', width: 960, height: 640, sha256: digest('b') };

/** A realistic computed result, built by the real workflow contract. */
const scientificResult = () =>
  createSegmentAndMeasureResult({
    image,
    segmentation: { image, model: { id: 'u2netp', version: '1' }, mask, threshold: 0.5, receipt: { id: 'seg' } },
    maskMeasurements: {
      area: { value: 12.4, unit: 'px2' },
      perimeter: { value: 40, unit: 'px' },
      boundingBox: { width: 4, height: 3, unit: 'px' },
      centroid: { x: 2, y: 1, unit: 'px' },
    },
    imageMeasurements: {
      color: { colorSpace: 'sRGB', channels: { red: 1, green: 2, blue: 3 } },
      sharpness: { metric: 'variance-of-laplacian', score: 8.5 },
    },
    classification: null,
  });

const recordingForm = () => {
  const calls = [];
  return { calls, setValue: async (reference, value) => { calls.push([reference, value]); } };
};

test('a dot path reads a nested measurement, and a missing path is absent not fatal', () => {
  const result = scientificResult();
  assert.equal(readResultValue(result, 'measurements.area.value'), 12.4);
  assert.equal(readResultValue(result, 'measurements.sharpness.score'), 8.5);
  assert.equal(readResultValue(result, 'classification.ranked.0.label'), undefined);
  assert.equal(readResultValue(result, 'nothing.here'), undefined);
  assert.throws(() => readResultValue(result, ''), ResultBindingError);
});

test('scalars coerce to the string an XForms field holds', () => {
  assert.equal(toXFormsValue(12.4), '12.4');
  assert.equal(toXFormsValue(0), '0');
  assert.equal(toXFormsValue('specimen'), 'specimen');
  assert.equal(toXFormsValue(true), 'true');
  assert.equal(toXFormsValue(false), 'false');
  // An absent optional measurement clears the field rather than throwing.
  assert.equal(toXFormsValue(null), '');
  assert.equal(toXFormsValue(undefined), '');
});

test('structured values are refused — an ImageAsset cannot become a field value', () => {
  // The structural guard: no mis-authored binding can stringify media into a
  // text field. Bind a scalar within the result, or use the attachment path.
  assert.throws(() => toXFormsValue(image), /Only scalar values/);
  assert.throws(() => toXFormsValue([1, 2]), ResultBindingError);
  assert.throws(() => toXFormsValue({ value: 1, unit: 'px' }), /Only scalar values/);
  assert.throws(() => toXFormsValue(Number.NaN), /non-finite/);
  assert.throws(() => toXFormsValue(Infinity), /non-finite/);
});

test('a computed result reaches form fields as values, with no attachment involved', async () => {
  const form = recordingForm();
  const write = createResultFieldWriter({
    form,
    bindings: [
      { reference: '/data/leaf_area', path: 'measurements.area.value' },
      { reference: '/data/leaf_area_unit', path: 'measurements.area.unit' },
      { reference: '/data/sharpness', path: 'measurements.sharpness.score' },
    ],
  });

  const written = await write(scientificResult());

  assert.deepEqual(form.calls, [
    ['/data/leaf_area', '12.4'],
    ['/data/leaf_area_unit', 'px2'],
    ['/data/sharpness', '8.5'],
  ]);
  assert.deepEqual(written.map((w) => w.present), [true, true, true]);
});

test('an absent optional value clears its field and is reported as absent', async () => {
  const form = recordingForm();
  const write = createResultFieldWriter({
    form,
    bindings: [{ reference: '/data/top_label', path: 'classification.ranked.0.label' }],
  });

  const written = await write(scientificResult());

  assert.deepEqual(form.calls, [['/data/top_label', '']]);
  assert.equal(written[0].present, false);
});

test('a mis-authored binding writes nothing at all', async () => {
  const form = recordingForm();
  const write = createResultFieldWriter({
    form,
    bindings: [
      { reference: '/data/leaf_area', path: 'measurements.area.value' },
      { reference: '/data/photo', path: 'image' }, // structured — refused
    ],
  });

  await assert.rejects(() => write(scientificResult()), ResultBindingError);
  // Coercion happens before any write, so the instance is never left partly
  // populated by a binding that was going to fail.
  assert.deepEqual(form.calls, []);
});

test('the writer validates its own configuration', () => {
  assert.throws(() => createResultFieldWriter({ bindings: [{ reference: '/a', path: 'b' }] }), /needs a form/);
  assert.throws(() => createResultFieldWriter({ form: recordingForm(), bindings: [] }), /at least one/);
  assert.throws(
    () => createResultFieldWriter({ form: recordingForm(), bindings: [{ path: 'a' }] }),
    /needs an XForms reference/,
  );
  assert.throws(
    () => createResultFieldWriter({ form: recordingForm(), bindings: [{ reference: '/a' }] }),
    /needs a value path/,
  );
});
