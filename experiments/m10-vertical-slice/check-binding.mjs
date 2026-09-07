/**
 * Does the M10 gate form bind the canonical Segment & Measure Tool?
 *
 * Runs the real `compositionBinding` against a node model transcribed from
 * `m10-gate-form.xml`, so an authoring mistake surfaces here rather than after
 * a Central publish and a device sync. It is not a substitute for the device
 * run — it cannot execute a model — but it is the cheapest place to learn that
 * an output has no destination.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CAPABILITY_DEFINITIONS } from 'gather-capabilities';

import {
  bindCompositionOutputs,
  resolveCompositionFields,
} from '../../src/xforms/compositions/compositionBinding.js';
import { a2uiFunctionId } from '../../src/a2ui/capabilityFunctions.js';
import { HOST_FUNCTION_IDS } from '../../src/a2ui/hostFunctions.js';

const definition = JSON.parse(
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

const GROUP = '/data/specimen';
const child = (name, valueType, nodeType = 'input', extra = {}) => ({
  reference: `${GROUP}/${name}`,
  nodeType,
  valueType,
  parentReference: GROUP,
  bodyBacked: true,
  required: false,
  gather: {},
  ...extra,
});

// Transcribed from m10-gate-form.xml.
const nodes = [
  { reference: '/data/site_name', nodeType: 'input', valueType: 'string', parentReference: '/data', bodyBacked: true, gather: {} },
  {
    reference: GROUP,
    nodeType: 'group',
    appearances: ['gather-composition'],
    gather: { composition: 'segment_and_measure_v1.gather' },
  },
  child('image', 'binary', 'upload', { mediaType: 'image' }),
  child('area', 'decimal'),
  child('area_unit', 'string'),
  child('model_id', 'string'),
  child('model_revision', 'string'),
];

const { fields, problems: fieldProblems } = resolveCompositionFields({ renderModel: { nodes } });
if (fieldProblems.length) {
  console.error('field problems:', fieldProblems);
  process.exit(1);
}
if (fields.length !== 1) {
  console.error(`expected one composition field, found ${fields.length}`);
  process.exit(1);
}

const { bindings, problems } = bindCompositionOutputs({ field: fields[0], definition });
if (problems.length) {
  console.error('binding problems:');
  for (const problem of problems) console.error(`  ${problem.code}: ${problem.message}`);
  process.exit(1);
}

console.log(`resource     ${fields[0].definitionResource}`);
console.log(`composition  ${definition.id}@${definition.revision}`);
for (const binding of bindings) {
  console.log(
    `  ${binding.path.padEnd(15)} → ${binding.reference.padEnd(28)} ` +
      `${binding.projection}${binding.required ? '  required' : ''}`
  );
}
const declared = definition.result.outputs.map((output) => output.path).sort();
const bound = bindings.map((binding) => binding.path).sort();
if (JSON.stringify(declared) !== JSON.stringify(bound)) {
  console.error(`\nunbound outputs: ${declared.filter((d) => !bound.includes(d)).join(', ')}`);
  process.exit(1);
}
console.log('\nevery declared output has a destination');

// Every call the Tool makes must be a function the runtime registers. A typo
// here is a press-time failure on the device — the exact class of defect the
// renderer's capability fixture shipped for months.
const available = new Set([
  ...Object.values(HOST_FUNCTION_IDS),
  ...CAPABILITY_DEFINITIONS.map((definition) => a2uiFunctionId(definition.id)),
]);
const calls = definition.messages
  .flatMap((message) => message.updateComponents?.components ?? [])
  .map((component) => component.action?.functionCall?.call)
  .filter(Boolean);
const unknown = calls.filter((call) => !available.has(call));
console.log(`calls        ${calls.join(', ')}`);
if (unknown.length) {
  console.error(`\nnot registered by the runtime: ${unknown.join(', ')}`);
  process.exit(1);
}
console.log('every call resolves to a registered function');
