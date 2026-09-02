import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  initializeGatherStorage,
  createFormsRepository,
  ASSET_RETENTION,
  createAssetsRepository,
  createEntitiesRepository,
  createInstancesRepository,
  createProjectsRepository,
  createSyncRepository,
  createFieldworkRepository,
  deleteFile,
  listDirectory,
  ensureProjectDirectories,
  deleteProjectDirectory,
  fileForKey,
  readBytes,
  readExternalBytes,
  readText,
  writeBytesAtomic,
  writeTextAtomic,
  fileExists,
  GatherPaths,
} from 'gather-storage';

import { bootstrapGather } from '../bootstrap.js';
import { shellForActiveProject } from '../navigation/routes.js';
import { GatherContext } from './GatherContext.js';
import { createPakoSettingsQrCodec } from '../provisioning/collectSettingsQrCodec.js';
import { createProvisioningService } from '../provisioning/provisioningService.js';
import { createFormCatalogService } from '../forms/formCatalogService.js';
import { createEntityService } from '../entities/entityService.js';
import { createInstanceLifecycleService } from '../instances/instanceLifecycleService.js';
import { sweepProjectAssets } from '../instances/assetCleanup.js';
import { createSyncService } from '../sync/syncService.js';
import { createFieldworkService } from '../fieldwork/fieldworkService.js';
import { createModelStore } from '../scientific/models/modelStore.js';
import { ensureBundledModel, installBundledModel } from '../scientific/models/bundledModelInstaller.js';
import { BUNDLED_MODEL_PACKAGES } from '../scientific/models/bundledModelPackages.js';
import { createReactNativeOnnxRuntime } from '../scientific/runtime/onnxReactNativeAdapter.js';
import { createOpenCvImageAdapter } from '../scientific/runtime/openCvImageAdapter.js';
import { createOpenCvMeasurementAdapter } from '../scientific/runtime/openCvMeasurementAdapter.js';
import { createModelExecutor } from '../scientific/runtime/modelExecutor.js';
import { createImageAssetService } from '../scientific/assets/imageAssetService.js';
import { segment, classify, measureImage, measureMask } from 'gather-capabilities';
import { createScientificModelRef } from '../scientific/models/modelPackage.js';

/**
 * Runs the (pure) bootstrap orchestration against the real native storage layer
 * exactly once, exposes the result via `GatherContext`, and owns the
 * active-project actions that switch the shell. All business logic lives in
 * `bootstrapGather` / the projects repository — this component is only the React
 * lifecycle + state wiring.
 *
 * @param {{
 *   children: React.ReactNode,
 *   deps?: { initializeStorage?: Function, createProjectsRepo?: Function },
 *   onReady?: (result: object) => void,
 *   onError?: (error: Error) => void,
 * }} props  `deps` is injectable so the navigation gate can drive the real
 *           provider with instrumented storage; production uses the defaults.
 */
export function GatherProvider({ children, deps, onReady, onError }) {
  const initializeStorage = deps?.initializeStorage ?? initializeGatherStorage;
  const createProjectsRepo = deps?.createProjectsRepo ?? createProjectsRepository;

  const [state, setState] = useState({ status: 'loading', error: null, boot: null });
  const [activeProject, setActiveProjectState] = useState(null);
  const [projectCount, setProjectCount] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const boot = await bootstrapGather({ initializeStorage, createProjectsRepo });
        if (cancelled) return;
        setActiveProjectState(boot.activeProject);
        setProjectCount(boot.projectCount);
        setState({ status: 'ready', error: null, boot });
        onReady?.(boot);
      } catch (error) {
        if (cancelled) return;
        setState({ status: 'error', error, boot: null });
        onError?.(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initializeStorage, createProjectsRepo, onReady, onError]);

  const projects = state.boot?.repositories.projects ?? null;
  const forms = useMemo(() => {
    const database = state.boot?.storage?.database;
    return database ? createFormsRepository(database) : null;
  }, [state.boot?.storage?.database]);
  const instances = useMemo(() => {
    const database = state.boot?.storage?.database;
    return database ? createInstancesRepository(database) : null;
  }, [state.boot?.storage?.database]);
  const entityRepository = useMemo(() => {
    const database = state.boot?.storage?.database;
    return database ? createEntitiesRepository(database) : null;
  }, [state.boot?.storage?.database]);
  const entityService = useMemo(
    () => (entityRepository ? createEntityService({ entities: entityRepository }) : null),
    [entityRepository]
  );
  const assets = useMemo(() => {
    const database = state.boot?.storage?.database ?? null;
    return database ? createAssetsRepository(database) : null;
  }, [state.boot?.storage]);
  const sync = useMemo(() => {
    const database = state.boot?.storage?.database;
    return database ? createSyncRepository(database) : null;
  }, [state.boot?.storage?.database]);
  const fieldwork = useMemo(() => {
    const database = state.boot?.storage?.database;
    return database ? createFieldworkRepository(database) : null;
  }, [state.boot?.storage?.database]);
  const formCatalog = useMemo(() => {
    if (!forms || !entityService || !state.boot?.storage) return null;
    return createFormCatalogService({
      forms,
      credentials: state.boot.storage.credentials,
      files: { readBytes, readText, writeBytesAtomic, writeTextAtomic },
      entities: entityService,
    });
  }, [entityService, forms, state.boot?.storage]);
  const instanceLifecycle = useMemo(() => {
    if (!instances || !formCatalog || !state.boot?.storage) return null;
    return createInstanceLifecycleService({
      instances,
      formCatalog,
      entityEffects: entityService,
      credentials: state.boot.storage.credentials,
      files: { readText, writeTextAtomic, writeBytesAtomic, fileForKey, deleteFile },
    });
  }, [instances, entityService, formCatalog, state.boot?.storage]);
  const syncService = useMemo(() => {
    if (!instances || !sync || !entityRepository || !instanceLifecycle) return null;
    return createSyncService({
      instances,
      sync,
      entities: entityRepository,
      instanceLifecycle,
    });
  }, [entityRepository, instances, sync, instanceLifecycle]);
  const fieldworkService = useMemo(() => {
    if (!fieldwork || !formCatalog || !instances) return null;
    return createFieldworkService({ sessions: fieldwork, formCatalog, instances });
  }, [fieldwork, formCatalog, instances]);
  const provisioningService = useMemo(() => {
    if (!projects || !instances || !state.boot?.storage) return null;
    return createProvisioningService({
      projects,
      credentials: state.boot.storage.credentials,
      files: { ensureProjectDirectories, deleteProjectDirectory },
      qrCodec: createPakoSettingsQrCodec(),
      getProjectUsage: async (projectKey) => {
        const saved = await instances.list(projectKey);
        return {
          drafts: saved.filter((instance) => instance.state === 'draft').length,
          ready: saved.filter((instance) => instance.state === 'ready').length,
        };
      },
    });
  }, [projects, instances, state.boot]);
  const modelStore = useMemo(() => {
    if (!state.boot?.storage) return null;
    return createModelStore({
      readBytes,
      readText,
      writeBytesAtomic,
      writeTextAtomic,
      fileExists,
      fileForKey,
    });
  }, [state.boot?.storage]);
  const scientificRuntime = useMemo(() => {
    if (!modelStore || !state.boot?.storage) return null;
    const files = { readBytes, readText, fileForKey };
    const imageAdapter = createOpenCvImageAdapter();
    return {
      executor: createModelExecutor({
        modelStore,
        onnxRuntime: createReactNativeOnnxRuntime(),
        imageAdapter,
        files,
        newAssetId: () => `mask-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`,
      }),
      measurementAdapter: createOpenCvMeasurementAdapter(),
    };
  }, [modelStore, state.boot?.storage]);
  const imageAssetService = useMemo(() => {
    if (!state.boot?.storage) return null;
    return createImageAssetService({
      readCaptureBytes: readExternalBytes,
      writeBytesAtomic,
      fileUriForKey: (key) => fileForKey(key).uri,
      newAssetId: () => `image-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`,
    });
  }, [state.boot?.storage]);

  const setActiveProject = useCallback(
    async (projectKey) => {
      if (!projects) throw new Error('storage not ready');
      const active = await projects.setActiveProject(projectKey);
      setActiveProjectState(active);
      return active;
    },
    [projects]
  );

  const clearActiveProject = useCallback(async () => {
    if (!projects) throw new Error('storage not ready');
    await projects.clearActiveProject();
    setActiveProjectState(null);
  }, [projects]);

  const refreshActiveProject = useCallback(async () => {
    if (!projects) return null;
    const active = await projects.getActiveProject();
    setActiveProjectState(active);
    return active;
  }, [projects]);

  const provisionManual = useCallback(
    async (input) => {
      if (!provisioningService || !projects) throw new Error('storage not ready');
      const result = await provisioningService.provisionManual(input);
      setActiveProjectState(await projects.getActiveProject());
      setProjectCount(await projects.countProjects());
      return result;
    },
    [provisioningService, projects]
  );

  const provisionQr = useCallback(
    async (rawQrText) => {
      if (!provisioningService || !projects) throw new Error('storage not ready');
      const result = await provisioningService.provisionQr(rawQrText);
      setActiveProjectState(await projects.getActiveProject());
      setProjectCount(await projects.countProjects());
      return result;
    },
    [provisioningService, projects]
  );

  const listProjects = useCallback(async () => {
    if (!provisioningService) throw new Error('storage not ready');
    return provisioningService.listProjects();
  }, [provisioningService]);

  const switchProject = useCallback(
    async (projectKey) => {
      if (!provisioningService) throw new Error('storage not ready');
      const project = await provisioningService.switchProject(projectKey);
      setActiveProjectState(await projects.getActiveProject());
      return project;
    },
    [provisioningService, projects]
  );

  const getRemovalPreview = useCallback(
    async (projectKey) => {
      if (!provisioningService) throw new Error('storage not ready');
      return provisioningService.getRemovalPreview(projectKey);
    },
    [provisioningService]
  );

  const removeProject = useCallback(
    async (projectKey, options) => {
      if (!provisioningService || !projects) throw new Error('storage not ready');
      const result = await provisioningService.removeProject(projectKey, options);
      if (result.removed) {
        setActiveProjectState(await projects.getActiveProject());
        setProjectCount(await projects.countProjects());
      }
      return result;
    },
    [provisioningService, projects]
  );

  const listCachedForms = useCallback(
    async (projectKey = activeProject?.projectKey) => {
      if (!formCatalog || !projectKey) return [];
      return formCatalog.listCachedForms(projectKey);
    },
    [activeProject?.projectKey, formCatalog]
  );

  const refreshForms = useCallback(
    async () => {
      if (!formCatalog || !activeProject) throw new Error('form catalog not ready');
      return formCatalog.refresh(activeProject);
    },
    [activeProject, formCatalog]
  );

  const loadCachedForm = useCallback(
    async (formId) => {
      if (!formCatalog || !activeProject) throw new Error('form catalog not ready');
      return formCatalog.loadCurrentForm(activeProject.projectKey, formId);
    },
    [activeProject, formCatalog]
  );

  const listInstances = useCallback(
    async (options) => {
      if (!instanceLifecycle || !activeProject) return [];
      return instanceLifecycle.list(activeProject, options);
    },
    [activeProject, instanceLifecycle]
  );

  const resumeInstance = useCallback(
    async ({ localInstanceId, form }) => {
      if (!instanceLifecycle || !activeProject) throw new Error('instance lifecycle not ready');
      return instanceLifecycle.resume({ localInstanceId, project: activeProject, form });
    },
    [activeProject, instanceLifecycle]
  );

  const saveInstanceDraft = useCallback(
    async ({ localInstanceId, form, version }) => {
      if (!instanceLifecycle || !activeProject) throw new Error('instance lifecycle not ready');
      return instanceLifecycle.saveDraft({ localInstanceId, project: activeProject, form, version });
    },
    [activeProject, instanceLifecycle]
  );

  const finalizeInstance = useCallback(
    async ({ localInstanceId, form, version }) => {
      if (!instanceLifecycle || !syncService || !activeProject) {
        throw new Error('instance lifecycle not ready');
      }
      const ready = await instanceLifecycle.finalize({
        localInstanceId,
        project: activeProject,
        form,
        version,
      });
      await syncService.enqueueReadyInstance({
        localInstanceId: ready.localInstanceId,
        project: activeProject,
      });
      return ready;
    },
    [activeProject, instanceLifecycle, syncService]
  );

  const attachImageMedia = useCallback(
    async ({ localInstanceId, form, version, reference, sourceFile, contentType }) => {
      if (!instanceLifecycle || !activeProject) throw new Error('instance lifecycle not ready');
      return instanceLifecycle.attachImageMedia({
        localInstanceId,
        project: activeProject,
        form,
        version,
        reference,
        sourceFile,
        contentType,
      });
    },
    [activeProject, instanceLifecycle]
  );

  const releaseInstanceMedia = useCallback(
    async ({ localInstanceId, form, version, filenames }) => {
      if (!instanceLifecycle || !activeProject) throw new Error('instance lifecycle not ready');
      return instanceLifecycle.releaseInstanceMedia({
        localInstanceId,
        project: activeProject,
        form,
        version,
        filenames,
      });
    },
    [activeProject, instanceLifecycle]
  );

  const discardInstance = useCallback(
    async (localInstanceId) => {
      if (!instanceLifecycle || !activeProject) throw new Error('instance lifecycle not ready');
      return instanceLifecycle.discard({ localInstanceId, project: activeProject });
    },
    [activeProject, instanceLifecycle]
  );

  const sendInstance = useCallback(
    async (localInstanceId) => {
      if (!syncService || !activeProject) throw new Error('submission sync not ready');
      return syncService.sendInstance({ localInstanceId, project: activeProject });
    },
    [activeProject, syncService]
  );

  const sendAllReadyInstances = useCallback(async () => {
    if (!syncService || !activeProject) throw new Error('submission sync not ready');
    return syncService.syncAll(activeProject);
  }, [activeProject, syncService]);

  const getSyncStatus = useCallback(async () => {
    if (!syncService || !activeProject) throw new Error('submission sync not ready');
    return syncService.getStatus(activeProject);
  }, [activeProject, syncService]);
  const listFieldworkSessions = useCallback(async () => {
    if (!fieldwork || !activeProject) throw new Error('fieldwork is not ready');
    return fieldwork.list(activeProject.projectKey);
  }, [activeProject, fieldwork]);
  const startFieldworkSession = useCallback(
    async (input) => {
      if (!fieldworkService || !activeProject) throw new Error('fieldwork is not ready');
      return fieldworkService.start({ project: activeProject, ...input });
    },
    [activeProject, fieldworkService]
  );
  const getFieldworkSession = useCallback(
    async (sessionId) => {
      if (!fieldworkService || !activeProject) throw new Error('fieldwork is not ready');
      return fieldworkService.get(activeProject, sessionId);
    },
    [activeProject, fieldworkService]
  );
  const updateFieldworkSession = useCallback(
    async (sessionId, patch) => {
      if (!fieldworkService || !activeProject) throw new Error('fieldwork is not ready');
      const session = await fieldworkService.get(activeProject, sessionId);
      return fieldworkService.update(session.session.sessionId, patch);
    },
    [activeProject, fieldworkService]
  );
  const associateFieldworkInstance = useCallback(
    async (input) => {
      if (!fieldworkService || !activeProject) throw new Error('fieldwork is not ready');
      const session = await fieldworkService.get(activeProject, input.sessionId);
      return fieldworkService.associateInstance({ ...input, sessionId: session.session.sessionId });
    },
    [activeProject, fieldworkService]
  );
  const installScientificModel = useCallback(
    async (name) => {
      if (!modelStore || !activeProject) throw new Error('model store is not ready');
      return installBundledModel({ modelStore, projectKey: activeProject.projectKey, name });
    },
    [activeProject, modelStore]
  );
  const resolveScientificModel = useCallback(
    async (modelRef) => {
      if (!modelStore || !activeProject) throw new Error('model store is not ready');
      return modelStore.resolve({ projectKey: activeProject.projectKey, modelRef });
    },
    [activeProject, modelStore]
  );
  const segmentScientificImage = useCallback(
    async ({ image, modelName = 'u2netp' }) => {
      if (!scientificRuntime || !activeProject) throw new Error('scientific runtime is not ready');
      const model = BUNDLED_MODEL_PACKAGES[modelName];
      await ensureBundledModel({ modelStore, projectKey: activeProject.projectKey, name: modelName });
      return segment({
        image,
        model,
        modelRef: createScientificModelRef(model),
        execute: (input) => scientificRuntime.executor.segment({ ...input, projectKey: activeProject.projectKey }),
      });
    },
    [activeProject, modelStore, scientificRuntime]
  );
  const classifyScientificImage = useCallback(
    async ({ image, modelName = 'mobilenetV3Large' }) => {
      if (!scientificRuntime || !activeProject) throw new Error('scientific runtime is not ready');
      const model = BUNDLED_MODEL_PACKAGES[modelName];
      await ensureBundledModel({ modelStore, projectKey: activeProject.projectKey, name: modelName });
      return classify({
        image,
        model,
        modelRef: createScientificModelRef(model),
        execute: (input) => scientificRuntime.executor.classify({ ...input, projectKey: activeProject.projectKey }),
      });
    },
    [activeProject, modelStore, scientificRuntime]
  );
  const measureScientificMask = useCallback(
    async ({ mask }) => measureMask({ mask, adapter: scientificRuntime?.measurementAdapter }),
    [scientificRuntime]
  );
  const measureScientificImage = useCallback(
    async ({ image, mask }) => measureImage({ image, mask, adapter: scientificRuntime?.measurementAdapter }),
    [scientificRuntime]
  );
  const persistScientificCapture = useCallback(
    async (capture, { retention = null } = {}) => {
      if (!imageAssetService || !activeProject) throw new Error('scientific image storage is not ready');
      const assetId = `image-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
      const fileKey = GatherPaths.media(activeProject.projectKey, `${assetId}.jpg`);
      const asset = await imageAssetService.persistCapture({
        capture,
        fileKey,
        capturedAt: new Date().toISOString(),
      });
      // Record it in the asset ledger. Without a row these bytes are
      // referenced by nothing in the database, which is what made project
      // cleanup unsafe: a sweep could not tell a deliberately-kept capture
      // from an orphan. `keep` is the conservative default; an authored
      // discard policy overrides it per output (B-custom §4).
      if (assets) {
        try {
          await assets.recordAsset({
            fileKey,
            projectKey: activeProject.projectKey,
            assetId,
            contentType: asset?.mimeType ?? capture?.contentType ?? 'image/jpeg',
            retention: retention ?? ASSET_RETENTION.KEEP,
          });
        } catch {
          // The bytes are already durable and usable. A missing ledger row
          // only makes this asset un-reclaimable, which the sweep's
          // conservative default already treats as "keep" — so never fail a
          // capture over bookkeeping.
        }
      }
      return asset;
    },
    [activeProject, assets, imageAssetService]
  );

  /**
   * Reclaims local-only assets this project no longer needs.
   *
   * Lives here rather than in any composition runtime: a composition declares
   * disposition, it does not know cleanup mechanics. Callers invoke this at
   * their own safe lifecycle boundaries.
   *
   * `reclaimOrphans` stays false, so a file with no ledger row is kept — see
   * docs/b-custom-composition-conventions.md §4.
   */
  const sweepProjectMedia = useCallback(async () => {
    if (!activeProject || !instances || !assets) return null;
    return sweepProjectAssets({
      projectKey: activeProject.projectKey,
      mediaDirectoryKey: GatherPaths.media(activeProject.projectKey),
      files: { listDirectory, deleteFile },
      instances,
      assets,
    });
  }, [activeProject, assets, instances]);

  const value = useMemo(
    () => ({
      status: state.status,
      error: state.error,
      storage: state.boot?.storage ?? null,
      repositories: { projects, forms, entities: entityRepository, instances, assets, sync, fieldwork, modelStore },
      projectCount,
      activeProject,
      shell: shellForActiveProject(activeProject),
      actions: {
        setActiveProject,
        clearActiveProject,
        refreshActiveProject,
        provisionManual,
        provisionQr,
        listProjects,
        switchProject,
        getRemovalPreview,
        removeProject,
        listCachedForms,
        refreshForms,
        loadCachedForm,
        listInstances,
        resumeInstance,
        saveInstanceDraft,
        finalizeInstance,
        attachImageMedia,
        releaseInstanceMedia,
        discardInstance,
        sendInstance,
        sendAllReadyInstances,
        getSyncStatus,
        listFieldworkSessions,
        startFieldworkSession,
        getFieldworkSession,
        updateFieldworkSession,
        associateFieldworkInstance,
        installScientificModel,
        resolveScientificModel,
        segmentScientificImage,
        classifyScientificImage,
        measureScientificMask,
        measureScientificImage,
        persistScientificCapture,
        sweepProjectMedia,
      },
    }),
    [
      state,
      projectCount,
      activeProject,
      setActiveProject,
      clearActiveProject,
      refreshActiveProject,
      provisionManual,
      provisionQr,
      listProjects,
      forms,
      entityRepository,
      instances,
      assets,
      sync,
      fieldwork,
      modelStore,
      switchProject,
      getRemovalPreview,
      removeProject,
      listCachedForms,
      refreshForms,
      loadCachedForm,
      listInstances,
      resumeInstance,
      saveInstanceDraft,
      finalizeInstance,
      attachImageMedia,
      releaseInstanceMedia,
      discardInstance,
      sendInstance,
      sendAllReadyInstances,
      getSyncStatus,
      listFieldworkSessions,
      startFieldworkSession,
      getFieldworkSession,
      updateFieldworkSession,
      associateFieldworkInstance,
      installScientificModel,
      resolveScientificModel,
      segmentScientificImage,
      classifyScientificImage,
      measureScientificMask,
      measureScientificImage,
      persistScientificCapture,
      sweepProjectMedia,
    ]
  );

  return <GatherContext.Provider value={value}>{children}</GatherContext.Provider>;
}
