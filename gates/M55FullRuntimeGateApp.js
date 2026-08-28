import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  closeGatherStorage,
  createFormsRepository,
  createInstancesRepository,
  createProjectsRepository,
  deleteFile,
  deleteProjectDirectory,
  ensureProjectDirectories,
  fileForKey,
  initializeGatherStorage,
  readBytes,
  readText,
  writeBytesAtomic,
  writeTextAtomic,
} from 'gather-storage';
import {
  WebViewXFormsHost,
  createSidecarWebViewProps,
  createWebViewSidecarHtml,
} from 'odk-xforms-webview';
import { XFormsProvider, useXForm } from 'odk-xforms-react';

import { createFormCatalogService } from '../src/forms/formCatalogService.js';
import { controlKindFor } from '../src/xforms/renderModel.js';
import {
  createInstanceLifecycleService,
  INSTANCE_LIFECYCLE_ERROR_CODES,
} from '../src/instances/instanceLifecycleService.js';
import { loadBundledFlowerImageFixture } from './fixtures/bundledImageFixture.js';
import { shellForActiveProject } from '../src/navigation/routes.js';
import { createPakoSettingsQrCodec } from '../src/provisioning/collectSettingsQrCodec.js';
import { createProvisioningService } from '../src/provisioning/provisioningService.js';

const ENTITY_FORM_ID = 'silphium_flower_survey_entities';
const ENTITY_REFERENCE = '/data/plant';
const FLOWER_COUNT_REFERENCE = '/data/flower_head_count';
const HEIGHT_REFERENCE = '/data/plant_height_cm';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeErrorCode = (error) =>
  typeof error?.code === 'string' && /^[A-Z0-9_:-]{1,100}$/.test(error.code)
    ? error.code
    : 'M55_RUNTIME_ERROR';
const valueFor = (snapshot, reference) => {
  const value = snapshot?.nodesByReference?.[reference]?.instanceValue ??
    snapshot?.nodesByReference?.[reference]?.value;
  return Array.isArray(value) ? value.map(String).join(' ') : String(value ?? '');
};
const isRequiredBinaryUpload = (node) =>
  node?.nodeType === 'upload' && node?.valueType === 'binary' && node?.required === true;
const isRequiredImageUpload = (node) => isRequiredBinaryUpload(node) && node?.mediaType === 'image';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const liveConfig = () => {
  const baseUrl = process.env.EXPO_PUBLIC_M55_CENTRAL_URL;
  const projectId = process.env.EXPO_PUBLIC_M55_CENTRAL_PROJECT_ID;
  const token = process.env.EXPO_PUBLIC_M55_CENTRAL_APP_USER_TOKEN;
  if (![baseUrl, projectId, token].every((value) => typeof value === 'string' && value.length > 0)) {
    return null;
  }
  return { baseUrl, projectId, token };
};

const servicesFor = (storage) => {
  const projects = createProjectsRepository(storage.database);
  const forms = createFormsRepository(storage.database);
  const instances = createInstancesRepository(storage.database);
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
  });
  const lifecycle = createInstanceLifecycleService({
    instances,
    formCatalog,
    credentials: storage.credentials,
    files: {
      readText,
      writeTextAtomic,
      writeBytesAtomic,
      fileForKey,
      deleteFile,
    },
  });
  return { projects, forms, instances, provisioning, formCatalog, lifecycle };
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
      services = servicesFor(await initializeGatherStorage());
      const initiallyClean = await cleanLocalCentralState(services, config);

      stage = 'manual-provision';
      const provisioned = await services.provisioning.provisionManual({
        baseUrl: config.baseUrl,
        projectId: config.projectId,
        token: config.token,
        displayName: 'M5.5 Central runtime gate',
      });
      const project = await services.projects.getActiveProject();
      if (!project) throw new Error('active project unavailable');

      stage = 'refresh-catalog';
      const refresh = await services.formCatalog.refresh(project);
      const visibleForms = await services.formCatalog.listCachedForms(project.projectKey);
      const visibleForm = visibleForms.find((entry) => entry.formId === ENTITY_FORM_ID) ?? null;
      if (!visibleForm) throw new Error('expected Entity-aware form was not cached');
      const cached = await services.formCatalog.loadCurrentForm(project.projectKey, ENTITY_FORM_ID);
      const entityResource = cached.version.resources.find(
        (resource) => resource.isEntityList && resource.filename === 'plants.csv'
      );
      const entityAttachment = cached.attachments.find((attachment) => attachment.filename === 'plants.csv');
      if (!entityResource || typeof entityAttachment?.text !== 'string') {
        throw new Error('expected cached plants.csv Entity List');
      }

      stage = 'open-form';
      await latest.current.loadForm(cached.xml, cached.attachments);
      await tick();
      const renderModel = latest.current.renderModel ?? (await latest.current.refreshRenderModel());
      const afterLoad = latest.current.snapshot;
      const entityChoices = afterLoad?.nodesByReference?.[ENTITY_REFERENCE]?.choices ?? [];
      const desiredChoiceIndex = Platform.OS === 'android' ? 1 : 0;
      const entityChoice =
        entityChoices.find((choice, index) => index === desiredChoiceIndex && UUID_RE.test(String(choice.value))) ??
        entityChoices.find((choice) => UUID_RE.test(String(choice.value)));
      if (!entityChoice) throw new Error('no live Entity choice was materialized');

      stage = 'enter-observation';
      await latest.current.setValue(ENTITY_REFERENCE, String(entityChoice.value));
      await latest.current.setValue(FLOWER_COUNT_REFERENCE, '5');
      await latest.current.setValue(HEIGHT_REFERENCE, '10.5');
      const photoType = renderModel?.nodes?.find((node) => /\/photo_type$/.test(node.reference ?? ''));
      if (photoType?.choices?.[0]?.value != null) {
        await latest.current.setValue(photoType.reference, String(photoType.choices[0].value));
      }
      const requiredUpload = renderModel?.nodes?.find(isRequiredBinaryUpload) ?? null;
      let fixture = null;
      let media = null;
      let draft;
      stage = 'attach-required-image';
      if (isRequiredImageUpload(requiredUpload)) {
        fixture = await loadBundledFlowerImageFixture();
        const bound = await services.lifecycle.attachImageMedia({
          project,
          form: { setValue: latest.current.setValue, serialize: latest.current.serialize },
          version: cached.version,
          reference: requiredUpload.reference,
          sourceFile: fixture.file,
          contentType: fixture.contentType,
        });
        draft = bound.instance;
        media = bound.media;
      } else {
        stage = 'save-draft';
        draft = await services.lifecycle.saveDraft({
          project,
          form: { serialize: latest.current.serialize },
          version: cached.version,
        });
      }
      await tick();
      const entered = latest.current.snapshot;
      const persistedXml = await readText(draft.xmlFileKey);
      const storedImageBytes = media ? await readBytes(media.fileKey) : null;
      const fixtureBytes = fixture ? await fixture.file.bytes() : null;

      stage = 'reinitialize-storage';
      await latest.current.loadForm(cached.xml, cached.attachments);
      const fresh = latest.current.snapshot;
      await closeGatherStorage();
      services = servicesFor(await initializeGatherStorage());
      const reopenedProject = await services.projects.getActiveProject();
      if (!reopenedProject) throw new Error('active project was not durable');

      stage = 'resume-draft';
      const resumed = await services.lifecycle.resume({
        localInstanceId: draft.localInstanceId,
        project: reopenedProject,
        form: { loadInstance: latest.current.loadInstance },
      });
      await tick();
      const restored = latest.current.snapshot;
      const serialized = await latest.current.serialize();

      stage = 'validate-finalize';
      let validationError = null;
      let ready = null;
      try {
        ready = await services.lifecycle.finalize({
          localInstanceId: draft.localInstanceId,
          project: reopenedProject,
          form: { serialize: latest.current.serialize },
          version: resumed.version,
        });
      } catch (error) {
        validationError = error;
      }

      const checks = {
        hermes: typeof HermesInternal !== 'undefined',
        cleanLocalGatherState: initiallyClean,
        manualProvisioningActivatedProject:
          provisioned.created === true &&
          shellForActiveProject(project) === 'project' &&
          project.centralProjectId === Number(config.projectId),
        formRefreshReachedCentral: refresh.refreshed.some((entry) => entry.formId === ENTITY_FORM_ID),
        silphiumVisibleInLocalCatalog: /silphium/i.test(visibleForm.displayName),
        cachedManifestHasPlantsEntityList: Boolean(entityResource),
        cachedPlantsCsvLoaded: entityAttachment.text.startsWith('name,label,__version'),
        entityChoiceMaterialized: entityChoices.some(
          (choice) => String(choice.value) === String(entityChoice.value)
        ),
        selectedRealEntity: valueFor(entered, ENTITY_REFERENCE) === String(entityChoice.value),
        observationValuesSet:
          valueFor(entered, FLOWER_COUNT_REFERENCE) === '5' &&
          valueFor(entered, HEIGHT_REFERENCE) === '10.5',
        draftSaved:
          draft.state === 'draft' &&
          persistedXml.includes('<flower_head_count>5</flower_head_count>') &&
          persistedXml.includes('<plant_height_cm>10.5</plant_height_cm>'),
        fixtureImageCopied:
          media != null &&
          fixtureBytes != null &&
          storedImageBytes != null &&
          fixtureBytes.byteLength === storedImageBytes.byteLength &&
          fixtureBytes.every((value, index) => value === storedImageBytes[index]),
        uploadFilenameBound:
          media != null &&
          valueFor(entered, requiredUpload?.reference) === media.filename &&
          persistedXml.includes(`<${requiredUpload?.reference?.split('/').pop()}>${media.filename}</`),
        draftMediaMetadata:
          media?.fileKey?.startsWith(`projects/${project.projectKey}/media/${draft.localInstanceId}/`) === true,
        storageReinitialized: reopenedProject.projectKey === project.projectKey,
        freshFormWasBlank:
          valueFor(fresh, FLOWER_COUNT_REFERENCE) === '' && valueFor(fresh, HEIGHT_REFERENCE) === '',
        resumedSameInstance:
          resumed.instance.odkInstanceId === draft.odkInstanceId &&
          valueFor(restored, ENTITY_REFERENCE) === String(entityChoice.value) &&
          valueFor(restored, FLOWER_COUNT_REFERENCE) === '5' &&
          valueFor(restored, HEIGHT_REFERENCE) === '10.5',
        resumedExactFormVersion:
          resumed.version.formVersionId === draft.formVersionId &&
          resumed.version.sourceVersion === draft.formVersion,
        resumedMediaMetadata:
          (await services.instances.listMedia(draft.localInstanceId)).some(
            (entry) =>
              entry.bindingReference === requiredUpload?.reference &&
              entry.filename === media?.filename &&
              entry.fileKey === media?.fileKey
          ),
        resumedUploadFilename:
          media != null &&
          valueFor(restored, requiredUpload?.reference) === media.filename &&
          serialized.xml.includes(`<${requiredUpload?.reference?.split('/').pop()}>${media.filename}</`),
        requiredImageUploadSupported:
          Boolean(requiredUpload) && controlKindFor(requiredUpload) === 'image-upload',
        validationFinalizesBoundUpload:
          ready?.state === 'ready' && validationError == null && serialized.violationCount === 0,
      };

      if (!checks.requiredImageUploadSupported) {
        payload = {
          ok: false,
          outcome: 'blocked',
          stage,
          blocker: 'required-upload-not-supported-image',
          checks: {
            ...checks,
            ready: false,
            foregroundSubmit: false,
            centralReadBack: false,
            sent: false,
          },
          validation: { violationCount: serialized.violationCount, finalizeError: safeErrorCode(validationError) },
          form: { id: ENTITY_FORM_ID, version: cached.version.sourceVersion },
          selectedEntityId: String(entityChoice.value),
        };
        return;
      }

      if (!ready) {
        throw validationError ?? new Error('finalization did not produce an instance');
      }
      stage = 'foreground-submit';
      const sent = await services.lifecycle.send({
        localInstanceId: ready.localInstanceId,
        project: reopenedProject,
      });
      const terminalChecks = {
        ...checks,
        ready: ready.state === 'ready',
        foregroundSubmit: sent.ok,
        sent: sent.instance.state === 'sent',
      };
      const terminalOk = Object.values(terminalChecks).every(Boolean);
      payload = {
        ok: terminalOk,
        outcome: terminalOk ? 'ready-for-readback' : 'failed',
        stage,
        checks: {
          ...terminalChecks,
          centralReadBack: false,
        },
        form: { id: ENTITY_FORM_ID, version: cached.version.sourceVersion },
        selectedEntityId: String(entityChoice.value),
        instanceId: sent.instance.odkInstanceId,
        submissionStatus: sent.ok ? 201 : null,
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
        };
      } finally {
        try {
          if (config && services) {
            cleanup = await cleanLocalCentralState(services, config);
          }
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

export default function M55FullRuntimeGateApp() {
  const webViewRef = useRef(null);
  const host = useMemo(() => new WebViewXFormsHost({ webViewRef, requestTimeoutMs: 60_000 }), []);
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
    console.log(`M55_FULL_RUNTIME_RESULT::${JSON.stringify(summary)}`);
  }, []);

  useEffect(() => {
    const watchdog = setTimeout(
      () =>
        finish({
          ok: false,
          outcome: 'failed',
          stage: 'watchdog',
          errorCode: 'M55_GATE_TIMEOUT',
          checks: {},
          cleanupLocalGatherState: false,
        }),
      180_000
    );
    return () => {
      clearTimeout(watchdog);
      host.dispose().catch(() => {});
    };
  }, [finish, host]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>M5.5 full runtime gate</Text>
      <Text style={styles.subtitle}>manual provisioning → durable Entity draft → resume → finalization</Text>
      <ScrollView>{result ? <Text style={result.ok ? styles.ok : styles.fail}>{JSON.stringify(result)}</Text> : null}</ScrollView>
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
