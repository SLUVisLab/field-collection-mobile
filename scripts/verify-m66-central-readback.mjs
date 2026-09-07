import { readFile } from 'node:fs/promises';

import { OdkCentralClient, createAppUserAuth } from 'odk-central-client';

const MARKER = 'M66_FULL_OFFLINE_RUNTIME_RESULT::';
const PREFLIGHT_MARKER = 'M66_CENTRAL_PREFLIGHT_RESULT::';
const READBACK_MARKER = 'M66_CENTRAL_READBACK_RESULT::';
const DEFAULT_REGISTRATION_FORM_ID = 'silphium_plant_registration';
const DEFAULT_OBSERVATION_FORM_ID = 'silphium_flower_survey_entities';
const DEFAULT_DATASET = 'plants';

const emit = (marker, value) => console.log(`${marker}${JSON.stringify(value)}`);

const formConfig = () => ({
  registrationFormId:
    process.env.M66_REGISTRATION_FORM_ID ??
    process.env.ODK_CENTRAL_REGISTRATION_FORM_ID ??
    DEFAULT_REGISTRATION_FORM_ID,
  observationFormId:
    process.env.M66_OBSERVATION_FORM_ID ??
    process.env.ODK_CENTRAL_ENTITY_FORM_ID ??
    DEFAULT_OBSERVATION_FORM_ID,
  dataset: process.env.M66_DATASET ?? process.env.ODK_CENTRAL_DATASET ?? DEFAULT_DATASET,
});

const required = (names) => names.filter((name) => !process.env[name]);

const entityBlock = (xml) => xml.match(/<entity\b[\s\S]*?<\/entity>|<entity\b[^>]*\/>/i)?.[0] ?? '';

const attribute = (element, name) =>
  element.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1] ?? null;

const tagValue = (xml, name) =>
  xml.match(new RegExp(`<${name}>([^<]*)</${name}>`, 'i'))?.[1] ?? null;

const targetFromGate = (gate) => {
  const fallback = gate?.cleanupTarget ?? {};
  const registrationForm = gate?.form?.registration;
  const observationForm = gate?.form?.observation;
  const registration =
    registrationForm || fallback.registration
      ? {
          ...fallback.registration,
          ...registrationForm,
          formId: registrationForm?.formId ?? registrationForm?.id ?? fallback.registration?.formId,
        }
      : null;
  const observation =
    observationForm || fallback.observation
      ? {
          ...fallback.observation,
          ...observationForm,
          formId: observationForm?.formId ?? observationForm?.id ?? fallback.observation?.formId,
        }
      : null;
  const entity = gate?.entity ?? {
    dataset: fallback.dataset,
    id: fallback.entityId,
  };
  return { registration, observation, entity };
};

const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const preflight = async () => {
  const missing = required([
    'ODK_CENTRAL_URL',
    'ODK_CENTRAL_PROJECT_ID',
    'ODK_CENTRAL_APP_USER_TOKEN',
  ]);
  if (missing.length > 0) {
    emit(PREFLIGHT_MARKER, { ok: false, blocker: 'app-user-preflight-config-missing' });
    process.exitCode = 2;
    return;
  }

  const config = formConfig();
  try {
    const client = new OdkCentralClient({
      baseUrl: process.env.ODK_CENTRAL_URL,
      projectId: process.env.ODK_CENTRAL_PROJECT_ID,
      auth: createAppUserAuth(process.env.ODK_CENTRAL_APP_USER_TOKEN),
      timeoutMs: 45_000,
    });
    const forms = await client.listForms();
    const registration = forms.find((form) => form.formId === config.registrationFormId) ?? null;
    const observation = forms.find((form) => form.formId === config.observationFormId) ?? null;
    const observationManifest = observation
      ? await client.getFormManifest({ formId: config.observationFormId })
      : [];
    const entityList = observationManifest.find(
      (entry) =>
        entry.isEntityList === true &&
        entry.integrityUrl?.includes(`/datasets/${encodeURIComponent(config.dataset)}/integrity`)
    );
    const checks = {
      registrationFormVisible: registration != null,
      observationFormVisible: observation != null,
      observationEntityListVisible: entityList != null,
    };
    const ok = Object.values(checks).every(Boolean);
    emit(PREFLIGHT_MARKER, {
      ok,
      checks,
      forms: {
        registration: registration
          ? { id: registration.formId, version: registration.version }
          : null,
        observation: observation
          ? { id: observation.formId, version: observation.version }
          : null,
        entityList: entityList ? { filename: entityList.filename, dataset: config.dataset } : null,
      },
    });
    process.exitCode = ok ? 0 : 1;
  } catch {
    emit(PREFLIGHT_MARKER, { ok: false, blocker: 'app-user-preflight-failed' });
    process.exitCode = 1;
  }
};

const readback = async (gateLog) => {
  const missing = required([
    'ODK_CENTRAL_URL',
    'ODK_CENTRAL_PROJECT_ID',
    'ODK_CENTRAL_EMAIL',
    'ODK_CENTRAL_PASSWORD',
  ]);
  if (missing.length > 0) {
    emit(READBACK_MARKER, { ok: false, blocker: 'web-user-readback-config-missing' });
    process.exitCode = 2;
    return;
  }

  let gate;
  try {
    const log = await readFile(gateLog, 'utf8');
    const line = log
      .split(/\r?\n/)
      .reverse()
      .find((candidate) => candidate.includes(MARKER));
    if (!line) {
      emit(READBACK_MARKER, { ok: false, blocker: 'device-terminal-marker-missing' });
      process.exitCode = 2;
      return;
    }
    gate = JSON.parse(line.slice(line.indexOf(MARKER) + MARKER.length).trim());
  } catch {
    emit(READBACK_MARKER, { ok: false, blocker: 'device-terminal-marker-invalid' });
    process.exitCode = 2;
    return;
  }

  const target = targetFromGate(gate);
  const hasCleanupTarget =
    isNonEmptyString(target.registration?.formId) &&
    isNonEmptyString(target.registration?.instanceId) &&
    isNonEmptyString(target.entity?.dataset) &&
    isNonEmptyString(target.entity?.id);
  if (!hasCleanupTarget) {
    emit(READBACK_MARKER, {
      ok: false,
      skipped: true,
      outcome: gate?.outcome ?? 'unknown',
      blocker: gate?.blocker ?? 'device-gate-did-not-produce-cleanup-target',
    });
    process.exitCode = 2;
    return;
  }

  const baseUrl = process.env.ODK_CENTRAL_URL.replace(/\/+$/, '');
  const projectId = encodeURIComponent(process.env.ODK_CENTRAL_PROJECT_ID);
  const loginResponse = await fetch(`${baseUrl}/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ODK_CENTRAL_EMAIL,
      password: process.env.ODK_CENTRAL_PASSWORD,
    }),
  }).catch(() => null);
  if (!loginResponse?.ok) {
    emit(READBACK_MARKER, { ok: false, blocker: 'web-user-login-failed' });
    process.exitCode = 1;
    return;
  }
  const login = await loginResponse.json().catch(() => null);
  if (!isNonEmptyString(login?.token)) {
    emit(READBACK_MARKER, { ok: false, blocker: 'web-user-session-missing' });
    process.exitCode = 1;
    return;
  }

  const headers = { Authorization: `Bearer ${login.token}` };
  const submissionUrl = ({ formId, instanceId }) =>
    `${baseUrl}/v1/projects/${projectId}/forms/${encodeURIComponent(formId)}/submissions/${encodeURIComponent(instanceId)}`;
  const entityUrl = `${baseUrl}/v1/projects/${projectId}/datasets/${encodeURIComponent(
    target.entity.dataset
  )}/entities/${encodeURIComponent(target.entity.id)}`;
  const request = async (url, options = {}) => {
    try {
      return await fetch(url, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
    } catch {
      return null;
    }
  };
  const readEntity = async () => {
    let response = null;
    let value = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      response = await request(entityUrl);
      value = response?.ok ? await response.json().catch(() => null) : null;
      if (response?.status === 200 && Number(value?.currentVersion?.version) >= 2) break;
      await wait(1000);
    }
    return { response, value };
  };
  const readSubmission = async (submission) => {
    if (!submission) return { detailResponse: null, xmlResponse: null, detail: null, xml: '' };
    const url = submissionUrl(submission);
    const [detailResponse, xmlResponse] = await Promise.all([request(url), request(`${url}.xml`)]);
    return {
      detailResponse,
      xmlResponse,
      detail: detailResponse?.ok ? await detailResponse.json().catch(() => null) : null,
      xml: xmlResponse?.ok ? await xmlResponse.text().catch(() => '') : '',
    };
  };

  const [registration, observation] = await Promise.all([
    readSubmission(target.registration),
    readSubmission(target.observation),
  ]);
  const { response: entityResponse, value: entity } = await readEntity();
  const registrationEntity = entityBlock(registration.xml);
  const observationEntity = entityBlock(observation.xml);
  const registrationProperties = target.entity.registrationProperties ?? {};
  const observationProperties = target.entity.observationProperties ?? {};
  const observationUrl = target.observation ? submissionUrl(target.observation) : null;
  const mediaResponse =
    observationUrl && isNonEmptyString(target.observation?.photoFilename)
      ? await request(`${observationUrl}/attachments/${encodeURIComponent(target.observation.photoFilename)}`)
      : null;

  const checks = {
    deviceGateReady: gate?.ok === true && gate?.outcome === 'ready-for-readback',
    registrationSubmissionFound:
      registration.detailResponse?.status === 200 && registration.xmlResponse?.status === 200,
    observationSubmissionFound:
      observation.detailResponse?.status === 200 && observation.xmlResponse?.status === 200,
    registrationInstanceId:
      registration.detail?.instanceId === target.registration.instanceId &&
      tagValue(registration.xml, 'instanceID') === target.registration.instanceId,
    observationInstanceId:
      observation.detail?.instanceId === target.observation?.instanceId &&
      tagValue(observation.xml, 'instanceID') === target.observation?.instanceId,
    registrationForm:
      attribute(registration.xml.match(/<data\b[^>]*>/i)?.[0] ?? '', 'id') === target.registration.formId,
    observationForm:
      attribute(observation.xml.match(/<data\b[^>]*>/i)?.[0] ?? '', 'id') === target.observation?.formId,
    registrationEntityCreate:
      attribute(registrationEntity, 'dataset') === target.entity.dataset &&
      attribute(registrationEntity, 'id') === target.entity.id &&
      ['1', 'true'].includes(attribute(registrationEntity, 'create')),
    observationEntityUpdate:
      attribute(observationEntity, 'dataset') === target.entity.dataset &&
      attribute(observationEntity, 'id') === target.entity.id &&
      ['1', 'true'].includes(attribute(observationEntity, 'update')) &&
      attribute(observationEntity, 'baseVersion') === '1' &&
      attribute(observationEntity, 'branchId') === target.entity.branchId,
    registrationProperties:
      tagValue(registration.xml, 'field_site') === registrationProperties.site &&
      tagValue(registration.xml, 'block') === registrationProperties.block &&
      tagValue(registration.xml, 'column') === registrationProperties.column &&
      tagValue(registration.xml, 'row') === registrationProperties.row &&
      tagValue(registration.xml, 'status') === registrationProperties.status &&
      tagValue(registration.xml, 'plant_code') === target.entity.label,
    observationValues:
      tagValue(observation.xml, 'plant') === target.entity.id &&
      tagValue(observation.xml, 'flower_head_count') === '6' &&
      tagValue(observation.xml, 'plant_height_cm') === '10.6' &&
      tagValue(observation.xml, 'plant_status') === observationProperties.status,
    requiredPhotoUploaded: mediaResponse?.status === 200,
    entityFound: entityResponse?.status === 200,
    entityVersion: Number(entity?.currentVersion?.version) === 2,
    entityLabel: entity?.currentVersion?.label === target.entity.label,
    entitySite: entity?.currentVersion?.data?.site === registrationProperties.site,
    entityStatus: entity?.currentVersion?.data?.status === observationProperties.status,
    entityLastObserved:
      entity?.currentVersion?.data?.last_observed === observationProperties.last_observed,
    entityNotConflicted: entity?.conflict == null,
  };

  const cleanup = {
    observationDeleteStatus: null,
    registrationDeleteStatus: null,
    entityDeleteStatus: null,
    observationAfterDeleteStatus: null,
    registrationAfterDeleteStatus: null,
    entityAfterDeleteStatus: null,
  };
  if (target.observation) {
    const response = await request(submissionUrl(target.observation), { method: 'DELETE' });
    cleanup.observationDeleteStatus = response?.status ?? null;
  }
  {
    const response = await request(submissionUrl(target.registration), { method: 'DELETE' });
    cleanup.registrationDeleteStatus = response?.status ?? null;
  }
  {
    const response = await request(entityUrl, { method: 'DELETE' });
    cleanup.entityDeleteStatus = response?.status ?? null;
  }
  if (target.observation) {
    const response = await request(submissionUrl(target.observation));
    cleanup.observationAfterDeleteStatus = response?.status ?? null;
  }
  {
    const response = await request(submissionUrl(target.registration));
    cleanup.registrationAfterDeleteStatus = response?.status ?? null;
  }
  {
    const response = await request(entityUrl);
    cleanup.entityAfterDeleteStatus = response?.status ?? null;
  }
  const cleanupSucceeded =
    (target.observation == null ||
      (cleanup.observationDeleteStatus != null && cleanup.observationAfterDeleteStatus === 404)) &&
    cleanup.registrationDeleteStatus != null &&
    cleanup.registrationAfterDeleteStatus === 404 &&
    cleanup.entityDeleteStatus != null &&
    cleanup.entityAfterDeleteStatus === 404;
  const ok = Object.values(checks).every(Boolean) && cleanupSucceeded;
  emit(READBACK_MARKER, { ok, checks, cleanupSucceeded, cleanup });
  process.exitCode = ok ? 0 : 1;
};

if (process.argv[2] === '--preflight') {
  await preflight();
} else if (!process.argv[2]) {
  console.error('usage: verify-m66-central-readback.mjs --preflight | <gate-log>');
  process.exitCode = 2;
} else {
  await readback(process.argv[2]);
}
