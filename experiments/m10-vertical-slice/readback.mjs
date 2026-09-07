/**
 * Reads the M10 submission back from Central and checks the whole chain landed.
 *
 * The important assertion is the last one. `model_revision` is projected from
 * `/working/segmentation/model/revision` — the **capability's output**, not the
 * `/working/modelRef` the Tool asked for. So comparing the two tells apart
 *
 *   the model the author named   (an input, at /working/modelRef)
 *   the model that executed      (an output, from image.segment)
 *
 * and a resolution bug cannot pass by echoing the form's own intent back.
 *
 *   node experiments/m10-vertical-slice/readback.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { ODK_CENTRAL_URL, ODK_CENTRAL_EMAIL, ODK_CENTRAL_PASSWORD } = process.env;
const PROJECT_ID = process.env.M10_PROJECT_ID ?? '2';
const FORM_ID = 'gather_m10_vertical_slice';

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
const authoredRef = definition.messages.find((m) => m.updateDataModel)?.updateDataModel.value.modelRef;

const base = ODK_CENTRAL_URL.replace(/\/+$/, '');
const session = await fetch(`${base}/v1/sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ODK_CENTRAL_EMAIL, password: ODK_CENTRAL_PASSWORD }),
});
const token = (await session.json()).token;
const call = async (path, raw = false) => {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`${path} → ${response.status}`);
  return raw ? response.text() : response.json();
};

const submissions = await call(`/v1/projects/${PROJECT_ID}/forms/${FORM_ID}/submissions`);
if (submissions.length === 0) {
  console.error('no submissions yet — run the device gate first');
  process.exit(1);
}
const latest = submissions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
console.log(`submission   ${latest.instanceId}  ${latest.createdAt}`);

const xml = await call(
  `/v1/projects/${PROJECT_ID}/forms/${FORM_ID}/submissions/${latest.instanceId}.xml`,
  true
);
const value = (name) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? null;

const fields = ['image', 'area', 'area_unit', 'model_id', 'model_revision'];
const failures = [];
for (const field of fields) {
  const got = value(field);
  const ok = got !== null && got !== '';
  console.log(`  ${field.padEnd(15)} ${ok ? got : '(EMPTY)'}`);
  if (!ok && field !== 'area_unit') failures.push(field);
}
if (/<gather_resources>/.test(xml)) failures.push('gather_resources leaked into the submission');

const attachments = await call(
  `/v1/projects/${PROJECT_ID}/forms/${FORM_ID}/submissions/${latest.instanceId}/attachments`
);
console.log('  attachments    ' + attachments.map((a) => `${a.name} exists=${a.exists}`).join(', '));
if (!attachments.some((a) => a.exists)) failures.push('no media attachment present');
if (value('image') && !attachments.some((a) => a.name === value('image'))) {
  failures.push(`image names ${value('image')} but no such attachment`);
}

console.log('\nmodel identity');
console.log(`  authored (input)   ${authoredRef.id} ${authoredRef.revision}`);
console.log(`  executed (output)  ${value('model_id')} ${value('model_revision')}`);
if (value('model_revision') !== authoredRef.revision || value('model_id') !== authoredRef.id) {
  // Not automatically a failure — it means resolution chose something else,
  // which is exactly what this comparison exists to surface rather than hide.
  failures.push('the executed model is not the authored one — investigate resolution');
}

console.log(failures.length ? `\nFAILED: ${failures.join('; ')}` : '\nthe whole chain landed');
process.exit(failures.length ? 1 : 0);
