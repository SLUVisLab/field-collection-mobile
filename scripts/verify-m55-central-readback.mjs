import { readFile } from 'node:fs/promises';

const MARKER = 'M55_FULL_RUNTIME_RESULT::';
const FORM_ID = 'silphium_flower_survey_entities';

const gateLog = process.argv[2];
if (!gateLog) {
  console.error('usage: verify-m55-central-readback.mjs <gate-log>');
  process.exit(2);
}

const required = [
  'ODK_CENTRAL_URL',
  'ODK_CENTRAL_PROJECT_ID',
  'ODK_CENTRAL_EMAIL',
  'ODK_CENTRAL_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.log(`M55_CENTRAL_READBACK_RESULT::${JSON.stringify({ ok: false, blocker: 'web-user-readback-config-missing' })}`);
  process.exit(2);
}

const log = await readFile(gateLog, 'utf8');
const markerLine = log
  .split(/\r?\n/)
  .reverse()
  .find((line) => line.includes(MARKER));
if (!markerLine) {
  console.log(`M55_CENTRAL_READBACK_RESULT::${JSON.stringify({ ok: false, blocker: 'device-terminal-marker-missing' })}`);
  process.exit(2);
}

let gate;
try {
  gate = JSON.parse(markerLine.slice(markerLine.indexOf(MARKER) + MARKER.length).trim());
} catch {
  console.log(`M55_CENTRAL_READBACK_RESULT::${JSON.stringify({ ok: false, blocker: 'device-terminal-marker-invalid' })}`);
  process.exit(2);
}

if (!gate.ok || !gate.instanceId || !gate.selectedEntityId || gate.form?.id !== FORM_ID) {
  console.log(
    `M55_CENTRAL_READBACK_RESULT::${JSON.stringify({
      ok: false,
      skipped: true,
      outcome: gate.outcome ?? 'unknown',
      blocker: gate.blocker ?? 'device-gate-did-not-submit',
    })}`
  );
  process.exit(2);
}

const baseUrl = process.env.ODK_CENTRAL_URL.replace(/\/+$/, '');
const projectId = encodeURIComponent(process.env.ODK_CENTRAL_PROJECT_ID);
const formId = encodeURIComponent(FORM_ID);
const instanceId = encodeURIComponent(gate.instanceId);
const login = await fetch(`${baseUrl}/v1/sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.ODK_CENTRAL_EMAIL,
    password: process.env.ODK_CENTRAL_PASSWORD,
  }),
});
if (!login.ok) {
  console.log(`M55_CENTRAL_READBACK_RESULT::${JSON.stringify({ ok: false, blocker: 'web-user-login-failed' })}`);
  process.exit(1);
}

const { token } = await login.json();
if (typeof token !== 'string' || token.length === 0) {
  console.log(`M55_CENTRAL_READBACK_RESULT::${JSON.stringify({ ok: false, blocker: 'web-user-session-missing' })}`);
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}` };
const submissionUrl = `${baseUrl}/v1/projects/${projectId}/forms/${formId}/submissions/${instanceId}`;
const [detailResponse, xmlResponse] = await Promise.all([
  fetch(submissionUrl, { headers }),
  fetch(`${submissionUrl}.xml`, { headers }),
]);
const detail = detailResponse.ok ? await detailResponse.json() : null;
const xml = xmlResponse.ok ? await xmlResponse.text() : '';
const tagValue = (name) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`, 'i'))?.[1] ?? null;
const entityId = xml.match(/<entity\b[^>]*\bid="([^"]+)"/i)?.[1] ?? null;
const version = xml.match(/<data\b[^>]*\bversion="([^"]+)"/i)?.[1] ?? null;
const checks = {
  submissionFound: detailResponse.status === 200 && xmlResponse.status === 200,
  instanceId: detail?.instanceId === gate.instanceId && tagValue('instanceID') === gate.instanceId,
  entityId: entityId === gate.selectedEntityId,
  observation:
    tagValue('flower_head_count') === '5' && tagValue('plant_height_cm') === '10.5',
  formVersion: version === gate.form.version,
};

let cleanup = false;
let deleteStatus = null;
let afterDeleteStatus = null;
if (Object.values(checks).every(Boolean)) {
  const deleted = await fetch(submissionUrl, { method: 'DELETE', headers });
  deleteStatus = deleted.status;
  if (deleted.ok) {
    const afterDelete = await fetch(submissionUrl, { headers });
    afterDeleteStatus = afterDelete.status;
    cleanup = afterDeleteStatus === 404;
  }
}

const ok = Object.values(checks).every(Boolean) && cleanup;
console.log(
  `M55_CENTRAL_READBACK_RESULT::${JSON.stringify({
    ok,
    checks,
    serverSubmissionRemoved: cleanup,
    deleteStatus,
    afterDeleteStatus,
  })}`
);
process.exit(ok ? 0 : 1);
