/**
 * Publishes the M10 gate form and its Tool to live ODK Central.
 *
 * Deliberately stock: a plain XForm definition, an attachment discovered by
 * Central's own scanner, and the ordinary form-resource API. If any of this
 * needed custom server behaviour the vertical slice would not be a vertical
 * slice.
 *
 * The distribution representation is the point: Central receives the canonical
 * `.a2ui.json` **bytes** under the `.gather` filename the form names. There is
 * no packaging step yet — `.gather` v2 as a container is M11 Phase 5 — so the
 * gate must not invent one, or it would prove a path the product does not have.
 *
 *   node experiments/m10-vertical-slice/provision.mjs
 *
 * Requires central-live.env in the repo root. Writes the App User token for the
 * device run to stdout.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));

const { ODK_CENTRAL_URL, ODK_CENTRAL_EMAIL, ODK_CENTRAL_PASSWORD } = process.env;
const PROJECT_ID = process.env.M10_PROJECT_ID ?? '2';
const FORM_ID = 'gather_m10_vertical_slice';
const RESOURCE = 'segment_and_measure_v1.gather';
const ARTIFACT = here(
  '../../compositions/segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json'
);

if (!ODK_CENTRAL_URL || !ODK_CENTRAL_EMAIL || !ODK_CENTRAL_PASSWORD) {
  console.error('source central-live.env first');
  process.exit(1);
}

const base = ODK_CENTRAL_URL.replace(/\/+$/, '');
let token;

const call = async (path, { method = 'GET', body, contentType, raw = false } = {}) => {
  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers['Content-Type'] = contentType;
  const response = await fetch(`${base}${path}`, { method, headers, body });
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`);
  }
  if (raw) return Buffer.from(await response.arrayBuffer());
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

// --- session -------------------------------------------------------------
const session = await fetch(`${base}/v1/sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ODK_CENTRAL_EMAIL, password: ODK_CENTRAL_PASSWORD }),
});
token = (await session.json()).token;

const project = await call(`/v1/projects/${PROJECT_ID}`);
console.log(`project      ${project.id}  ${project.name}`);

// --- the form definition, as a draft ------------------------------------
const definitionXml = readFileSync(here('./m10-gate-form.xml'));
const existing = (await call(`/v1/projects/${PROJECT_ID}/forms`)).find(
  (form) => form.xmlFormId === FORM_ID
);
if (existing) {
  await call(`/v1/projects/${PROJECT_ID}/forms/${FORM_ID}/draft`, {
    method: 'POST',
    body: definitionXml,
    contentType: 'application/xml',
  });
  console.log(`form         ${FORM_ID}  new draft on existing form`);
} else {
  await call(`/v1/projects/${PROJECT_ID}/forms?ignoreWarnings=true`, {
    method: 'POST',
    body: definitionXml,
    contentType: 'application/xml',
  });
  console.log(`form         ${FORM_ID}  created as draft`);
}

// --- does Central expect our resource? ----------------------------------
const attachments = await call(
  `/v1/projects/${PROJECT_ID}/forms/${FORM_ID}/draft/attachments`
);
console.log('expected attachments:');
for (const attachment of attachments) {
  console.log(`  ${attachment.name}  type=${attachment.type}  exists=${attachment.exists}`);
}
if (!attachments.some((attachment) => attachment.name === RESOURCE)) {
  console.error(`\nCentral did not derive ${RESOURCE} as an expected attachment.`);
  process.exit(1);
}

// --- upload the Tool, opaquely ------------------------------------------
const artifact = readFileSync(ARTIFACT);
await call(`/v1/projects/${PROJECT_ID}/forms/${FORM_ID}/draft/attachments/${RESOURCE}`, {
  method: 'POST',
  body: artifact,
  contentType: 'application/octet-stream',
});

const roundTripped = await call(
  `/v1/projects/${PROJECT_ID}/forms/${FORM_ID}/draft/attachments/${RESOURCE}`,
  { raw: true }
);
const before = sha256(artifact);
const after = sha256(roundTripped);
console.log(`artifact     ${artifact.length} bytes  sha256:${before.slice(0, 16)}…`);
console.log(`round trip   ${roundTripped.length} bytes  sha256:${after.slice(0, 16)}…  ${
  before === after ? 'IDENTICAL' : 'CHANGED'
}`);
if (before !== after) {
  console.error('\nCentral transformed the artifact. It must stay opaque.');
  process.exit(1);
}

// --- publish -------------------------------------------------------------
const version = `m10-${before.slice(0, 6)}`;
await call(
  `/v1/projects/${PROJECT_ID}/forms/${FORM_ID}/draft/publish?version=${encodeURIComponent(version)}`,
  { method: 'POST' }
);
console.log(`published    version ${version}`);

// --- an App User for the device -----------------------------------------
const appUsers = await call(`/v1/projects/${PROJECT_ID}/app-users`);
const named = appUsers.find((user) => user.displayName === 'M10 device' && !user.deletedAt);
const appUser =
  named ??
  (await call(`/v1/projects/${PROJECT_ID}/app-users`, {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ displayName: 'M10 device' }),
  }));
await call(`/v1/projects/${PROJECT_ID}/forms/${FORM_ID}/assignments/2/${appUser.id}`, {
  method: 'POST',
}).catch(() => {});

console.log('\nfor the device run:');
console.log(`  M10_PROJECT_ID=${PROJECT_ID}`);
console.log(`  M10_FORM_ID=${FORM_ID}`);
console.log(`  M10_APP_USER_TOKEN=${appUser.token}`);
