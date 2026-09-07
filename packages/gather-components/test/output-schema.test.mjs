import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOutputReviewSections } from '../src/results/outputSchema.js';

test('output schema renders core scalar and summary formats', () => {
  const data = {
    specimen: {
      label: 'Leaf A',
      confidence: 0.987,
      accepted: true,
      mass: { value: 4.5, unit: 'g' },
      notes: ['fresh', 'intact'],
      image: {
        assetId: 'image-1',
        mimeType: 'image/jpeg',
        width: 640,
        height: 480,
      },
    },
  };
  const schema = {
    sections: [{ id: 'summary', label: 'Summary' }],
    fields: [
      { path: 'specimen.label', label: 'Label', format: 'string', section: 'summary' },
      { path: 'specimen.confidence', label: 'Confidence', format: 'percentage', section: 'summary', decimals: 1, scale: 'fraction' },
      { path: 'specimen.accepted', label: 'Accepted', format: 'boolean', section: 'summary' },
      { path: 'specimen.mass.value', label: 'Mass', format: 'quantity', unitPath: 'specimen.mass.unit', section: 'summary', decimals: 1 },
      { path: 'specimen.notes', label: 'Notes', format: 'array', section: 'summary' },
      { path: 'specimen.image', label: 'Image', format: 'asset', section: 'summary' },
    ],
  };

  const sections = buildOutputReviewSections({ data, schema });
  assert.equal(sections.length, 1);
  assert.deepEqual(
    sections[0].rows.map((row) => `${row.label}: ${row.value}`),
    [
      'Label: Leaf A',
      'Confidence: 98.7%',
      'Accepted: Yes',
      'Mass: 4.5 g',
      'Notes: fresh, intact',
      'Image: image/jpeg · 640 x 480 · image-1',
    ]
  );
});

test('output schema supports visibility and array item formatting metadata', () => {
  const data = {
    showSecondary: false,
    classification: {
      ranked: [
        { label: 'Maple', score: 0.91 },
        { label: 'Oak', score: 0.06 },
      ],
    },
  };
  const schema = {
    sections: [
      { id: 'classification', label: 'Classification' },
      { id: 'secondary', label: 'Secondary', visiblePath: 'showSecondary' },
    ],
    fields: [
      {
        path: 'classification.ranked',
        label: 'Top labels',
        section: 'classification',
        format: 'array',
        itemLabelPath: 'label',
        itemValuePath: 'score',
        itemValueFormat: 'percentage',
        itemValueScale: 'fraction',
        itemValueDecimals: 1,
      },
      {
        path: 'missing.value',
        label: 'Secondary value',
        section: 'secondary',
        format: 'string',
      },
    ],
  };

  const sections = buildOutputReviewSections({ data, schema });
  assert.equal(sections.length, 1);
  assert.equal(sections[0].label, 'Classification');
  assert.equal(sections[0].rows[0].value, 'Maple (91.0%), Oak (6.0%)');
});

test('output schema infers a sensible default review when metadata is absent', () => {
  const result = {
    image: { assetId: 'image-1', mimeType: 'image/jpeg', width: 960, height: 640 },
    measurements: {
      area: { value: 3200, unit: 'px2' },
      perimeter: { value: 280, unit: 'px' },
      approved: true,
    },
    classification: {
      ranked: [
        { label: 'fixture specimen', score: 0.99 },
        { label: 'other', score: 0.01 },
      ],
    },
  };

  const sections = buildOutputReviewSections({ data: result });
  const sectionLabels = sections.map((section) => section.label);
  assert.deepEqual(sectionLabels, ['Image', 'Measurements', 'Classification']);

  const measurements = sections.find((section) => section.id === 'measurements');
  assert.ok(measurements);
  assert.ok(measurements.rows.some((row) => row.label === 'Area' && row.value === '3200 px2'));
  assert.ok(measurements.rows.some((row) => row.label === 'Approved' && row.value === 'Yes'));

  const classification = sections.find((section) => section.id === 'classification');
  assert.ok(classification);
  assert.ok(classification.rows.some((row) => row.value === 'fixture specimen (99.0%), other (1.0%)'));
});
