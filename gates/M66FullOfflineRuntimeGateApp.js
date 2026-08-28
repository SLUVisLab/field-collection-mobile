import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  closeGatherStorage,
  createEntitiesRepository,
  createFormsRepository,
  createInstancesRepository,
  createProjectsRepository,
  createSyncRepository,
  deleteFile,
  deleteProjectDirectory,
  ensureProjectDirectories,
  fileForKey,
  initializeGatherStorage,
  parseCsv,
  readBytes,
  readText,
  writeBytesAtomic,
  writeTextAtomic,
} from 'gather-storage';
import { OdkCentralClient, createAppUserAuth } from 'odk-central-client';
import {
  WebViewXFormsHost,
  createSidecarWebViewProps,
  createWebViewSidecarHtml,
} from 'odk-xforms-webview';
import { XFormsProvider, useXForm } from 'odk-xforms-react';

import { createEntityService } from '../src/entities/entityService.js';
import { createFormCatalogService } from '../src/forms/formCatalogService.js';
import { createInstanceLifecycleService } from '../src/instances/instanceLifecycleService.js';
import { shellForActiveProject } from '../src/navigation/routes.js';
import { createPakoSettingsQrCodec } from '../src/provisioning/collectSettingsQrCodec.js';
import { createProvisioningService } from '../src/provisioning/provisioningService.js';
import { createSyncService } from '../src/sync/syncService.js';
import { controlKindFor } from '../src/xforms/renderModel.js';
import { loadBundledFlowerImageFixture } from './fixtures/bundledImageFixture.js';

const DEFAULT_REGISTRATION_FORM_ID = 'silphium_plant_registration';
const DEFAULT_OBSERVATION_FORM_ID = 'silphium_flower_survey_entities';
const DEFAULT_DATASET = 'plants';
const REGISTRATION_REFS = Object.freeze({
  site: '/data/field_site',
  block: '/data/block',
  column: '/data/column',
  row: '/data/row',
  location: '/data/plant_location',
  status: '/data/status',
});
const OBSERVATION_REFS = Object.freeze({
  plant: '/data/plant',
  site: '/data/field_site',
  block: '/data/block',
  column: '/data/column',
  row: '/data/row',
  plantCode: '/data/plant_code',
  entityVersion: '/data/entity_version',
  flowerHeadCount: '/data/flower_head_count',
  plantHeightCm: '/data/plant_height_cm',
  plantStatus: '/data/plant_status',
});
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeErrorCode = (error) =>
  typeof error?.code === 'string' && /^[A-Z0-9_:-]{1,100}$/.test(error.code)
    ? error.code
    : 'M66_RUNTIME_ERROR';

const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};

const requireCheck = (condition, code) => {
  if (!condition) fail(code);
};

const valueFor = (snapshot, reference) => {
  const value =
    snapshot?.nodesByReference?.[reference]?.instanceValue ??
    snapshot?.nodesByReference?.[reference]?.value;
  return Array.isArray(value) ? value.map(String).join(' ') : String(value ?? '');
};

const choicesFor = (form, renderModel, reference) =>
  form.snapshot?.nodesByReference?.[reference]?.choices ??
  renderModel?.nodes?.find((node) => node.reference === reference)?.choices ??
  [];

const stringChoice = (choice) => (choice?.value == null ? null : String(choice.value));

const isRequiredBinaryUpload = (node) =>
  node?.nodeType === 'upload' && node?.valueType === 'binary' && node?.required === true;

const isRequiredImageUpload = (node) => isRequiredBinaryUpload(node) && node?.mediaType === 'image';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const shortRunId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid === 'string' && uuid.length >= 8) return uuid.slice(0, 8);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12);
};

const lifecycleFormFor = (form) => ({
  serialize: () => form.serialize(),
  getEntityEffects: () => form.getEntityEffects(),
  setValue: (reference, value) => form.setValue(reference, value),
});

const rowForEntity = (csv, entityId) => {
  const records = parseCsv(csv);
  const header = records[0] ?? [];
  const nameIndex = header.indexOf('name');
  if (nameIndex < 0) return null;
  const row = records.slice(1).find((candidate) => candidate[nameIndex] === entityId);
  return row == null ? null : Object.fromEntries(header.map((column, index) => [column, row[index] ?? '']));
};

const entityResourceFor = (cached, dataset) =>
  cached.version.resources.find(
    (resource) =>
      resource.isEntityList === true &&
      resource.entityDataset === dataset &&
      typeof resource.filename === 'string'
  ) ?? null;

const entityAttachmentFor = (cached, resource) =>
  cached.attachments.find((attachment) => attachment.filename === resource?.filename) ?? null;

const liveConfig = () => {
  const baseUrl = process.env.EXPO_PUBLIC_M66_CENTRAL_URL;
  const projectId = process.env.EXPO_PUBLIC_M66_CENTRAL_PROJECT_ID;
  const token = process.env.EXPO_PUBLIC_M66_CENTRAL_APP_USER_TOKEN;
  const registrationFormId =
    process.env.EXPO_PUBLIC_M66_REGISTRATION_FORM_ID ?? DEFAULT_REGISTRATION_FORM_ID;
  const observationFormId =
    process.env.EXPO_PUBLIC_M66_OBSERVATION_FORM_ID ?? DEFAULT_OBSERVATION_FORM_ID;
  const dataset = process.env.EXPO_PUBLIC_M66_DATASET ?? DEFAULT_DATASET;
  if (
    ![baseUrl, projectId, token, registrationFormId, observationFormId, dataset].every(
      (value) => typeof value === 'string' && value.length > 0
    )
  ) {
    return null;
  }
  return { baseUrl, projectId, token, registrationFormId, observationFormId, dataset };
};

const servicesFor = (storage, network) => {
  const projects = createProjectsRepository(storage.database);
  const forms = createFormsRepository(storage.database);
  const entities = createEntitiesRepository(storage.database);
  const instances = createInstancesRepository(storage.database);
  const sync = createSyncRepository(storage.database);
  const entityService = createEntityService({ entities });
  const createClient = ({ baseUrl, centralProjectId, token }) =>
    new OdkCentralClient({
      baseUrl,
      projectId: centralProjectId,
      auth: createAppUserAuth(token),
      fetch: network.fetch,
      timeoutMs: 45_000,
    });
  const getProjectUsage = async (projectKey) => {
    const saved = await instances.list(projectKey);
    return {
      drafts: saved.filter((instance) => instance.state === 'draft').length,
      ready: saved.filter((instance) => instance.state === 'ready').length,
    };
  };
  const provisioning = createProvisioningService({
    projects,
    credentials: storage.credentials,
    files: {
      ensureProjectDirectories,
      deleteProjectDirectory,
    },
    qrCodec: createPakoSettingsQrCodec(),
    getProjectUsage,
  });
  const formCatalog = createFormCatalogService({
    forms,
    credentials: storage.credentials,
    files: {
      readBytes,
      readText,
      writeBytesAtomic,
      writeTextAtomic,
    },
    entities: entityService,
    createClient,
  });
  const lifecycle = createInstanceLifecycleService({
    instances,
    formCatalog,
    entityEffects: entityService,
    credentials: storage.credentials,
    files: {
      readText,
      writeTextAtomic,
      writeBytesAtomic,
      fileForKey,
      deleteFile,
    },
    createClient,
  });
  const journal = { attemptingBeforeDispatch: [], dispatchOrder: [] };
  const syncService = createSyncService({
    instances,
    sync,
    entities,
    instanceLifecycle: {
      async send({ localInstanceId, project }) {
        journal.attemptingBeforeDispatch.push(
          await sync.getSubmissionOperation({ projectKey: project.projectKey, localInstanceId })
        );
        journal.dispatchOrder.push(localInstanceId);
        return lifecycle.send({ localInstanceId, project });
      },
    },
  });
  return {
    projects,
    forms,
    entities,
    instances,
    sync,
    provisioning,
    formCatalog,
    lifecycle,
    syncService,
    journal,
  };
};

const cleanLocalCentralState = async (services, config) => {
  const matchingProjects = (await services.projects.listProjects()).filter(
    (project) =>
      project.baseUrl === config.baseUrl.replace(/\/+$/, '') &&
      Number(project.centralProjectId) === Number(config.projectId)
  );
  for (const project of matchingProjects) {
    await services.provisioning.removeProject(project.projectKey, { confirmed: true });
  }
  return (await services.projects.listProjects()).every(
    (project) =>
      project.baseUrl !== config.baseUrl.replace(/\/+$/, '') ||
      Number(project.centralProjectId) !== Number(config.projectId)
  );
};

function RuntimeScenario({ onComplete }) {
  const form = useXForm();
  const latest = useRef(form);
  const started = useRef(false);
  latest.current = form;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    let config = null;
    let services = null;
    let cleanup = false;
    let stage = 'configuration';
    let payload = null;
    let cleanupTarget = null;
    const network = {
      offline: false,
      offlineRequestCount: 0,
      allowedRequestCount: 0,
      fetch: async (...args) => {
        if (network.offline) {
          network.offlineRequestCount += 1;
          fail('M66_OFFLINE_NETWORK_ACCESS');
        }
        network.allowedRequestCount += 1;
        return fetch(...args);
      },
    };

    const run = async () => {
      config = liveConfig();
      if (!config) {
        payload = {
          ok: false,
          outcome: 'blocked',
          stage,
          blocker: 'live-config-missing',
          checks: {},
        };
        return;
      }

      stage = 'clean-local-state';
      services = servicesFor(await initializeGatherStorage(), network);
      const initiallyClean = await cleanLocalCentralState(services, config);

      stage = 'manual-provision';
      const provisioned = await services.provisioning.provisionManual({
        baseUrl: config.baseUrl,
        projectId: config.projectId,
        token: config.token,
        displayName: 'M6.6 Central offline runtime gate',
      });
      const project = await services.projects.getActiveProject();
      requireCheck(project != null, 'M66_ACTIVE_PROJECT_UNAVAILABLE');

      stage = 'refresh-catalog';
      const refresh = await services.formCatalog.refresh(project);
      const cachedForms = await services.formCatalog.listCachedForms(project.projectKey);
      const registrationCatalog = cachedForms.find(
        (entry) => entry.formId === config.registrationFormId
      );
      const observationCatalog = cachedForms.find(
        (entry) => entry.formId === config.observationFormId
      );
      requireCheck(registrationCatalog != null, 'M66_REGISTRATION_FORM_NOT_CACHED');
      requireCheck(observationCatalog != null, 'M66_OBSERVATION_FORM_NOT_CACHED');
      const registration = await services.formCatalog.loadCurrentForm(
        project.projectKey,
        config.registrationFormId
      );
      const observationBaseline = await services.formCatalog.loadCurrentForm(
        project.projectKey,
        config.observationFormId
      );
      const observationResource = entityResourceFor(observationBaseline, config.dataset);
      const observationAttachment = entityAttachmentFor(observationBaseline, observationResource);
      requireCheck(observationResource != null, 'M66_ENTITY_LIST_NOT_CACHED');
      requireCheck(typeof observationAttachment?.text === 'string', 'M66_ENTITY_LIST_NOT_TEXT');
      const immutableSourceCsv = await readText(observationResource.fileKey);
      const initialCentralRequestCount = network.allowedRequestCount;

      // All catalog traffic is now complete. The injected fetch rejects and records
      // any accidental Central request until the final explicit sync.
      network.offline = true;
      const runId = shortRunId();
      const registrationSite = `M66-${runId}`;
      const registrationValues = {
        site: registrationSite,
        block: '66',
        column: '6',
        row: '6',
        location: '38.5242 -90.5582 0 5',
      };

      stage = 'offline-registration';
      await latest.current.loadForm(registration.xml, registration.attachments);
      await tick();
      const registrationRenderModel = await latest.current.refreshRenderModel();
      const registrationStatusChoices = choicesFor(
        latest.current,
        registrationRenderModel,
        REGISTRATION_REFS.status
      );
      const registrationStatusChoice =
        registrationStatusChoices.find((choice) => stringChoice(choice) === 'active') ??
        registrationStatusChoices[0];
      requireCheck(registrationStatusChoice != null, 'M66_REGISTRATION_STATUS_UNAVAILABLE');
      const registrationStatus = stringChoice(registrationStatusChoice);
      requireCheck(registrationStatus != null, 'M66_REGISTRATION_STATUS_INVALID');
      await latest.current.setValue(REGISTRATION_REFS.site, registrationValues.site);
      await latest.current.setValue(REGISTRATION_REFS.block, registrationValues.block);
      await latest.current.setValue(REGISTRATION_REFS.column, registrationValues.column);
      await latest.current.setValue(REGISTRATION_REFS.row, registrationValues.row);
      await latest.current.setValue(REGISTRATION_REFS.location, registrationValues.location);
      await latest.current.setValue(REGISTRATION_REFS.status, registrationStatus);
      await tick();
      const registrationSnapshot = latest.current.snapshot;
      const registrationReady = await services.lifecycle.finalize({
        project,
        // Entity effects must cross the lifecycle's public Form-like seam. The
        // gate never derives them from serialized XML or XForm definitions.
        form: lifecycleFormFor(latest.current),
        version: registration.version,
      });
      const registrationEffects = await services.entities.listEffectsForInstance(
        registrationReady.localInstanceId
      );
      const registrationEffect = registrationEffects[0] ?? null;
      requireCheck(registrationEffects.length === 1, 'M66_REGISTRATION_EFFECT_COUNT');
      requireCheck(registrationEffect?.action === 'create', 'M66_REGISTRATION_EFFECT_ACTION');
      requireCheck(registrationEffect?.dataset === config.dataset, 'M66_REGISTRATION_EFFECT_DATASET');
      requireCheck(UUID_RE.test(registrationEffect?.entityId ?? ''), 'M66_REGISTRATION_ENTITY_ID_INVALID');
      requireCheck(
        registrationEffect?.properties?.site === registrationValues.site &&
          registrationEffect?.properties?.block === registrationValues.block &&
          registrationEffect?.properties?.column === registrationValues.column &&
          registrationEffect?.properties?.row === registrationValues.row &&
          registrationEffect?.properties?.status === registrationStatus &&
          String(registrationEffect?.properties?.geometry ?? '').startsWith('38.5242 -90.5582'),
        'M66_REGISTRATION_EFFECT_PROPERTIES'
      );
      requireCheck(
        typeof registrationEffect?.label === 'string' &&
          registrationEffect.label === valueFor(registrationSnapshot, '/data/plant_code') &&
          registrationEffect.label.length > 0,
        'M66_REGISTRATION_EFFECT_LABEL'
      );
      cleanupTarget = {
        dataset: config.dataset,
        entityId: registrationEffect.entityId,
        registration: {
          formId: config.registrationFormId,
          instanceId: registrationReady.odkInstanceId,
        },
      };

      stage = 'offline-observation';
      const observation = await services.formCatalog.loadCurrentForm(
        project.projectKey,
        config.observationFormId
      );
      const synthesizedResource = entityResourceFor(observation, config.dataset);
      const synthesizedAttachment = entityAttachmentFor(observation, synthesizedResource);
      const createdEntityRow = rowForEntity(
        synthesizedAttachment?.text ?? '',
        registrationEffect.entityId
      );
      requireCheck(createdEntityRow != null, 'M66_CREATED_ENTITY_NOT_SYNTHESIZED');
      requireCheck(
        createdEntityRow.__version === '1' &&
          createdEntityRow.__trunkVersion === '' &&
          createdEntityRow.__branchId === registrationEffect.branchId,
        'M66_CREATED_ENTITY_OVERLAY_INVALID'
      );
      await latest.current.loadForm(observation.xml, observation.attachments);
      await tick();
      const observationRenderModel = await latest.current.refreshRenderModel();
      const entityChoices = choicesFor(
        latest.current,
        observationRenderModel,
        OBSERVATION_REFS.plant
      );
      const createdEntityChoice = entityChoices.find(
        (choice) => stringChoice(choice) === registrationEffect.entityId
      );
      requireCheck(createdEntityChoice != null, 'M66_CREATED_ENTITY_CHOICE_MISSING');
      const observationStatusChoices = choicesFor(
        latest.current,
        observationRenderModel,
        OBSERVATION_REFS.plantStatus
      );
      const observationStatusChoice =
        observationStatusChoices.find((choice) => stringChoice(choice) !== registrationStatus) ??
        observationStatusChoices[0];
      requireCheck(observationStatusChoice != null, 'M66_OBSERVATION_STATUS_UNAVAILABLE');
      const observationStatus = stringChoice(observationStatusChoice);
      requireCheck(observationStatus != null, 'M66_OBSERVATION_STATUS_INVALID');
      await latest.current.setValue(OBSERVATION_REFS.plant, registrationEffect.entityId);
      await latest.current.setValue(OBSERVATION_REFS.flowerHeadCount, '6');
      await latest.current.setValue(OBSERVATION_REFS.plantHeightCm, '10.6');
      await latest.current.setValue(OBSERVATION_REFS.plantStatus, observationStatus);
      const photoType = observationRenderModel?.nodes?.find((node) => /\/photo_type$/.test(node.reference ?? ''));
      requireCheck(photoType?.choices?.[0]?.value != null, 'M66_PHOTO_TYPE_UNAVAILABLE');
      await latest.current.setValue(photoType.reference, String(photoType.choices[0].value));
      const requiredUpload = observationRenderModel?.nodes?.find(isRequiredBinaryUpload) ?? null;
      if (!isRequiredImageUpload(requiredUpload)) {
        payload = {
          ok: false,
          outcome: 'blocked',
          stage,
          blocker: 'required-upload-not-supported-image',
          checks: {
            requiredImageUploadSupported: false,
            offlineNetworkAccessPrevented: network.offlineRequestCount === 0,
          },
          form: {
            registration: { id: config.registrationFormId, version: registration.version.sourceVersion },
            observation: { id: config.observationFormId, version: observation.version.sourceVersion },
          },
        };
        return;
      }
      const fixture = await loadBundledFlowerImageFixture();
      const bound = await services.lifecycle.attachImageMedia({
        project,
        form: lifecycleFormFor(latest.current),
        version: observation.version,
        reference: requiredUpload.reference,
        sourceFile: fixture.file,
        contentType: fixture.contentType,
      });
      const observationDraft = bound.instance;
      const media = bound.media;
      await tick();
      const observationSnapshot = latest.current.snapshot;
      const [persistedImageBytes, fixtureBytes, observationDraftXml] = await Promise.all([
        readBytes(media.fileKey),
        fixture.file.bytes(),
        readText(observationDraft.xmlFileKey),
      ]);

      stage = 'offline-observation-finalize';
      const observationReady = await services.lifecycle.finalize({
        localInstanceId: observationDraft.localInstanceId,
        project,
        form: lifecycleFormFor(latest.current),
        version: observation.version,
      });
      const observationEffects = await services.entities.listEffectsForInstance(
        observationReady.localInstanceId
      );
      const observationEffect = observationEffects[0] ?? null;
      requireCheck(observationEffects.length === 1, 'M66_OBSERVATION_EFFECT_COUNT');
      requireCheck(observationEffect?.action === 'update', 'M66_OBSERVATION_EFFECT_ACTION');
      requireCheck(
        observationEffect?.dataset === config.dataset &&
          observationEffect?.entityId === registrationEffect.entityId &&
          observationEffect?.baseVersion === '1' &&
          observationEffect?.trunkVersion === '' &&
          observationEffect?.branchId === registrationEffect.branchId,
        'M66_OBSERVATION_EFFECT_IDENTITY'
      );
      requireCheck(
        observationEffect?.properties?.status === observationStatus &&
          typeof observationEffect?.properties?.last_observed === 'string' &&
          observationEffect.properties.last_observed.length > 0,
        'M66_OBSERVATION_EFFECT_PROPERTIES'
      );
      cleanupTarget = {
        ...cleanupTarget,
        observation: {
          formId: config.observationFormId,
          instanceId: observationReady.odkInstanceId,
          photoFilename: media.filename,
        },
      };

      stage = 'offline-open-reload';
      const reloadedObservation = await services.formCatalog.loadCurrentForm(
        project.projectKey,
        config.observationFormId
      );
      const reloadedResource = entityResourceFor(reloadedObservation, config.dataset);
      const reloadedAttachment = entityAttachmentFor(reloadedObservation, reloadedResource);
      const updatedEntityRow = rowForEntity(reloadedAttachment?.text ?? '', registrationEffect.entityId);
      requireCheck(updatedEntityRow != null, 'M66_UPDATED_ENTITY_NOT_SYNTHESIZED');
      requireCheck(
        updatedEntityRow.__version === '2' &&
          updatedEntityRow.__trunkVersion === '' &&
          updatedEntityRow.__branchId === registrationEffect.branchId &&
          updatedEntityRow.status === observationStatus &&
          updatedEntityRow.last_observed === observationEffect.properties.last_observed,
        'M66_UPDATED_ENTITY_OVERLAY_INVALID'
      );
      await latest.current.loadForm(reloadedObservation.xml, reloadedObservation.attachments);
      await tick();
      await latest.current.setValue(OBSERVATION_REFS.plant, registrationEffect.entityId);
      await tick();
      const reloadedSnapshot = latest.current.snapshot;
      requireCheck(
        valueFor(reloadedSnapshot, OBSERVATION_REFS.site) === registrationValues.site &&
          valueFor(reloadedSnapshot, OBSERVATION_REFS.block) === registrationValues.block &&
          valueFor(reloadedSnapshot, OBSERVATION_REFS.column) === registrationValues.column &&
          valueFor(reloadedSnapshot, OBSERVATION_REFS.row) === registrationValues.row &&
          valueFor(reloadedSnapshot, OBSERVATION_REFS.plantCode) === registrationEffect.label &&
          valueFor(reloadedSnapshot, OBSERVATION_REFS.entityVersion) === '2',
        'M66_OPEN_RELOAD_CALCULATIONS_INVALID'
      );

      stage = 'journal-dependencies';
      const registrationOperation = await services.syncService.enqueueReadyInstance({
        localInstanceId: registrationReady.localInstanceId,
        project,
      });
      const observationOperation = await services.syncService.enqueueReadyInstance({
        localInstanceId: observationReady.localInstanceId,
        project,
      });
      const dependencyReconciliation = await services.syncService.reconcile(project);
      const operationsBeforeRestart = await services.sync.listOperations(project.projectKey);
      const dependenciesBeforeRestart = await services.sync.listDependencies(project.projectKey);
      const observationDependsOnRegistration = dependenciesBeforeRestart.some(
        (dependency) =>
          dependency.operationId === observationOperation.operationId &&
          dependency.dependsOnOperationId === registrationOperation.operationId
      );
      requireCheck(
        operationsBeforeRestart.length === 2 &&
          operationsBeforeRestart.every(
            (operation) => operation.state === 'pending' && operation.attemptCount === 0
          ) &&
          observationDependsOnRegistration &&
          dependencyReconciliation.addedDependencyCount >= 1,
        'M66_JOURNAL_DEPENDENCY_INVALID'
      );

      stage = 'offline-storage-restart';
      await closeGatherStorage();
      services = servicesFor(await initializeGatherStorage(), network);
      const restartedProject = await services.projects.getActiveProject();
      requireCheck(restartedProject?.projectKey === project.projectKey, 'M66_PROJECT_RESTART_INVALID');
      const restartedObservation = await services.formCatalog.loadCurrentForm(
        restartedProject.projectKey,
        config.observationFormId
      );
      const restartedResource = entityResourceFor(restartedObservation, config.dataset);
      const restartedAttachment = entityAttachmentFor(restartedObservation, restartedResource);
      const restartedEntityRow = rowForEntity(
        restartedAttachment?.text ?? '',
        registrationEffect.entityId
      );
      await latest.current.loadForm(restartedObservation.xml, restartedObservation.attachments);
      await tick();
      await latest.current.setValue(OBSERVATION_REFS.plant, registrationEffect.entityId);
      await tick();
      const restartedSnapshot = latest.current.snapshot;
      const operationsAfterRestart = await services.sync.listOperations(restartedProject.projectKey);
      const dependenciesAfterRestart = await services.sync.listDependencies(restartedProject.projectKey);
      const restartedObservationDependsOnRegistration = dependenciesAfterRestart.some(
        (dependency) =>
          dependency.operationId === observationOperation.operationId &&
          dependency.dependsOnOperationId === registrationOperation.operationId
      );
      requireCheck(
        restartedEntityRow?.__version === '2' &&
          restartedEntityRow?.__branchId === registrationEffect.branchId &&
          restartedEntityRow?.status === observationStatus &&
          restartedEntityRow?.last_observed === observationEffect.properties.last_observed &&
          valueFor(restartedSnapshot, OBSERVATION_REFS.plantCode) === registrationEffect.label &&
          operationsAfterRestart.length === 2 &&
          operationsAfterRestart.every(
            (operation) => operation.state === 'pending' && operation.attemptCount === 0
          ) &&
          restartedObservationDependsOnRegistration,
        'M66_STORAGE_RESTART_INVALID'
      );
      requireCheck(network.offlineRequestCount === 0, 'M66_OFFLINE_NETWORK_ACCESS');

      stage = 'reconnect-send-all';
      network.offline = false;
      const sent = await services.syncService.syncAll(restartedProject);
      const operationsAfterSend = await services.sync.listOperations(restartedProject.projectKey);
      const sentByInstance = new Map(sent.map((result) => [result.instance?.localInstanceId, result]));
      const registrationSent = sentByInstance.get(registrationReady.localInstanceId);
      const observationSent = sentByInstance.get(observationReady.localInstanceId);
      const attemptsAreOrdered = services.journal.attemptingBeforeDispatch.every(
        (operation, index) =>
          operation?.state === 'attempting' &&
          operation.attemptCount === 1 &&
          operation.localInstanceId ===
            [registrationReady.localInstanceId, observationReady.localInstanceId][index]
      );
      const checks = {
        hermes: typeof HermesInternal !== 'undefined',
        cleanLocalGatherState: initiallyClean,
        manualProvisioningActivatedProject:
          provisioned.created === true &&
          shellForActiveProject(project) === 'project' &&
          project.centralProjectId === Number(config.projectId),
        registrationFormRefreshed: refresh.refreshed.some(
          (entry) => entry.formId === config.registrationFormId
        ),
        observationFormRefreshed: refresh.refreshed.some(
          (entry) => entry.formId === config.observationFormId
        ),
        currentFormsInCatalog: registrationCatalog != null && observationCatalog != null,
        observationResourcesCached:
          observation.version.resources.length === observation.attachments.length &&
          observationResource != null &&
          observationAttachment?.text != null,
        registrationFinalized: registrationReady.state === 'ready',
        registrationEffectsRecorded:
          registrationEffect?.action === 'create' &&
          registrationEffect?.entityId != null &&
          registrationEffect?.branchId != null,
        createdEntityInSeparateSurveyChoice: createdEntityChoice != null,
        observationValuesSet:
          valueFor(observationSnapshot, OBSERVATION_REFS.plant) === registrationEffect.entityId &&
          valueFor(observationSnapshot, OBSERVATION_REFS.flowerHeadCount) === '6' &&
          valueFor(observationSnapshot, OBSERVATION_REFS.plantHeightCm) === '10.6' &&
          valueFor(observationSnapshot, OBSERVATION_REFS.plantStatus) === observationStatus,
        requiredImageUploadSupported: controlKindFor(requiredUpload) === 'image-upload',
        fixtureImageCopied:
          fixtureBytes.byteLength === persistedImageBytes.byteLength &&
          fixtureBytes.every((value, index) => value === persistedImageBytes[index]),
        uploadFilenameBound:
          valueFor(observationSnapshot, requiredUpload.reference) === media.filename &&
          observationDraftXml.includes(
            `<${requiredUpload.reference.split('/').pop()}>${media.filename}</`
          ),
        observationFinalized: observationReady.state === 'ready',
        observationEffectsRecorded:
          observationEffect?.action === 'update' &&
          observationEffect?.baseVersion === '1' &&
          observationEffect?.branchId === registrationEffect.branchId,
        cachedEntityResourceImmutable:
          !immutableSourceCsv.includes(registrationEffect.entityId) &&
          immutableSourceCsv !== reloadedAttachment?.text,
        openReloadConfirmsUpdatedEntity:
          updatedEntityRow?.status === observationStatus &&
          updatedEntityRow?.last_observed === observationEffect.properties.last_observed &&
          valueFor(reloadedSnapshot, OBSERVATION_REFS.entityVersion) === '2',
        offlineNetworkAccessPrevented: network.offlineRequestCount === 0,
        journalOperationsPersisted:
          operationsAfterRestart.length === 2 &&
          operationsAfterRestart.every((operation) => operation.state === 'pending'),
        entityDependencyPersisted:
          dependenciesAfterRestart.length === 1 && restartedObservationDependsOnRegistration,
        sendAllSubmissionOrder:
          services.journal.dispatchOrder.join(',') ===
          [registrationReady.localInstanceId, observationReady.localInstanceId].join(','),
        journalAttemptedBeforeCentralDispatch:
          services.journal.attemptingBeforeDispatch.length === 2 && attemptsAreOrdered,
        sendAllSucceeded: registrationSent?.ok === true && observationSent?.ok === true,
        instancesSent:
          registrationSent?.instance?.state === 'sent' && observationSent?.instance?.state === 'sent',
        journalCompleted:
          operationsAfterSend.length === 2 &&
          operationsAfterSend.every(
            (operation) =>
              operation.state === 'complete' &&
              operation.attemptCount === 1 &&
              operation.lastErrorCode == null &&
              operation.lastErrorSummary == null
          ),
        finalCentralRequestsStarted: network.allowedRequestCount > initialCentralRequestCount,
      };
      const terminalOk = Object.values(checks).every(Boolean);
      payload = {
        ok: terminalOk,
        outcome: terminalOk ? 'ready-for-readback' : 'failed',
        stage,
        checks: { ...checks, centralReadBack: false },
        form: {
          registration: {
            id: config.registrationFormId,
            version: registration.version.sourceVersion,
            instanceId: registrationReady.odkInstanceId,
          },
          observation: {
            id: config.observationFormId,
            version: observation.version.sourceVersion,
            instanceId: observationReady.odkInstanceId,
            photoFilename: media.filename,
          },
        },
        entity: {
          dataset: config.dataset,
          id: registrationEffect.entityId,
          label: registrationEffect.label,
          branchId: registrationEffect.branchId,
          registrationProperties: registrationEffect.properties,
          observationProperties: observationEffect.properties,
        },
        journal: {
          registrationOperationId: registrationOperation.operationId,
          observationOperationId: observationOperation.operationId,
          dependencyCount: dependenciesAfterRestart.length,
          dispatchOrder: services.journal.dispatchOrder,
        },
        cleanupTarget,
      };
    };

    void (async () => {
      try {
        await run();
      } catch (error) {
        payload = {
          ok: false,
          outcome: 'failed',
          stage,
          errorCode: safeErrorCode(error),
          checks: {},
          cleanupTarget,
        };
      } finally {
        try {
          if (config && services) cleanup = await cleanLocalCentralState(services, config);
          await closeGatherStorage();
        } catch {
          cleanup = false;
        }
        await latest.current.inspectMediaSeam().catch(() => null);
        if (!cancelled) onComplete({ ...payload, cleanupLocalGatherState: cleanup });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  return null;
}

export default function M66FullOfflineRuntimeGateApp() {
  const webViewRef = useRef(null);
  const host = useMemo(
    () => new WebViewXFormsHost({ webViewRef, requestTimeoutMs: 60_000 }),
    []
  );
  const html = useMemo(() => createWebViewSidecarHtml(), []);
  const webViewProps = useMemo(
    () => createSidecarWebViewProps({ html, onMessage: (event) => host.handleWebViewMessage(event) }),
    [html, host]
  );
  const emitted = useRef(false);
  const [result, setResult] = useState(null);

  const finish = useCallback((payload) => {
    if (emitted.current) return;
    emitted.current = true;
    const summary = { platform: Platform.OS, ...payload };
    setResult(summary);
    console.log(`M66_FULL_OFFLINE_RUNTIME_RESULT::${JSON.stringify(summary)}`);
  }, []);

  useEffect(() => {
    const watchdog = setTimeout(
      () =>
        finish({
          ok: false,
          outcome: 'failed',
          stage: 'watchdog',
          errorCode: 'M66_GATE_TIMEOUT',
          checks: {},
          cleanupLocalGatherState: false,
        }),
      240_000
    );
    return () => {
      clearTimeout(watchdog);
      host.dispose().catch(() => {});
    };
  }, [finish, host]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>M6.6 Central offline runtime gate</Text>
      <Text style={styles.subtitle}>refresh → offline Entity create/update → restart → ordered sync</Text>
      <ScrollView>
        {result ? <Text style={result.ok ? styles.ok : styles.fail}>{JSON.stringify(result)}</Text> : null}
      </ScrollView>
      <XFormsProvider host={host}>
        <RuntimeScenario onComplete={finish} />
      </XFormsProvider>
      <WebView ref={webViewRef} {...webViewProps} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 20, paddingTop: 64 },
  title: { color: '#1b1b1f', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#5a5a63', marginTop: 4 },
  ok: { color: '#1a7f37', marginTop: 20 },
  fail: { color: '#cf222e', marginTop: 20 },
});
