import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  initializeGatherStorage,
  createFormsRepository,
  createInstancesRepository,
  createProjectsRepository,
  deleteFile,
  ensureProjectDirectories,
  deleteProjectDirectory,
  fileForKey,
  readBytes,
  readText,
  writeBytesAtomic,
  writeTextAtomic,
} from 'gather-storage';

import { bootstrapGather } from '../bootstrap.js';
import { shellForActiveProject } from '../navigation/routes.js';
import { GatherContext } from './GatherContext.js';
import { createPakoSettingsQrCodec } from '../provisioning/collectSettingsQrCodec.js';
import { createProvisioningService } from '../provisioning/provisioningService.js';
import { createFormCatalogService } from '../forms/formCatalogService.js';
import { createInstanceLifecycleService } from '../instances/instanceLifecycleService.js';

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
  const formCatalog = useMemo(() => {
    if (!forms || !state.boot?.storage) return null;
    return createFormCatalogService({
      forms,
      credentials: state.boot.storage.credentials,
      files: { readBytes, readText, writeBytesAtomic, writeTextAtomic },
    });
  }, [forms, state.boot?.storage]);
  const instanceLifecycle = useMemo(() => {
    if (!instances || !formCatalog || !state.boot?.storage) return null;
    return createInstanceLifecycleService({
      instances,
      formCatalog,
      credentials: state.boot.storage.credentials,
      files: { readText, writeTextAtomic, writeBytesAtomic, fileForKey, deleteFile },
    });
  }, [instances, formCatalog, state.boot?.storage]);
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
      if (!instanceLifecycle || !activeProject) throw new Error('instance lifecycle not ready');
      return instanceLifecycle.finalize({ localInstanceId, project: activeProject, form, version });
    },
    [activeProject, instanceLifecycle]
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

  const discardInstance = useCallback(
    async (localInstanceId) => {
      if (!instanceLifecycle || !activeProject) throw new Error('instance lifecycle not ready');
      return instanceLifecycle.discard({ localInstanceId, project: activeProject });
    },
    [activeProject, instanceLifecycle]
  );

  const sendInstance = useCallback(
    async (localInstanceId) => {
      if (!instanceLifecycle || !activeProject) throw new Error('instance lifecycle not ready');
      return instanceLifecycle.send({ localInstanceId, project: activeProject });
    },
    [activeProject, instanceLifecycle]
  );

  const sendAllReadyInstances = useCallback(async () => {
    if (!instanceLifecycle || !activeProject) throw new Error('instance lifecycle not ready');
    return instanceLifecycle.sendAll(activeProject);
  }, [activeProject, instanceLifecycle]);

  const value = useMemo(
    () => ({
      status: state.status,
      error: state.error,
      storage: state.boot?.storage ?? null,
      repositories: { projects, forms, instances },
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
        discardInstance,
        sendInstance,
        sendAllReadyInstances,
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
      instances,
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
      discardInstance,
      sendInstance,
      sendAllReadyInstances,
    ]
  );

  return <GatherContext.Provider value={value}>{children}</GatherContext.Provider>;
}
