import { OdkCentralClient, createAppUserAuth } from 'odk-central-client';

import { parseCollectSettingsQr } from './collectSettingsQr.js';

export class ProvisioningError extends Error {
  constructor(
    message,
    { code = 'GATHER_PROVISIONING_FAILED', stage = 'provisioning', recovery = null } = {}
  ) {
    super(message);
    this.name = 'ProvisioningError';
    this.code = code;
    // Deliberately keep this serializable metadata categorical. In particular,
    // never attach an underlying network error because it could contain a key URL.
    this.details = { stage, ...(recovery ? { recovery } : {}) };
  }
}

const failure = (message, options) => new ProvisioningError(message, options);

const nonEmptyString = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw failure(`Enter a ${field}.`, {
      code: 'GATHER_PROVISIONING_INVALID',
      stage: 'validation',
    });
  }
  return value.trim();
};

const normalizeBaseUrl = (value) => {
  const baseUrl = nonEmptyString(value, 'Central server URL');
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw failure('Enter a valid HTTPS Central server URL.', {
      code: 'GATHER_PROVISIONING_INVALID',
      stage: 'validation',
    });
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw failure('Enter a valid HTTPS Central server URL.', {
      code: 'GATHER_PROVISIONING_INVALID',
      stage: 'validation',
    });
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${pathname}`;
};

const normalizeProjectId = (value) => {
  const text = `${value ?? ''}`.trim();
  if (!/^[1-9][0-9]*$/.test(text)) {
    throw failure('Project ID must be a positive whole number.', {
      code: 'GATHER_PROVISIONING_INVALID',
      stage: 'validation',
    });
  }
  const projectId = Number(text);
  if (!Number.isSafeInteger(projectId)) {
    throw failure('Project ID must be a positive whole number.', {
      code: 'GATHER_PROVISIONING_INVALID',
      stage: 'validation',
    });
  }
  return projectId;
};

const normalizeToken = (value) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw failure('Enter an App User token.', {
      code: 'GATHER_PROVISIONING_INVALID',
      stage: 'validation',
    });
  }
  return value;
};

export const normalizeManualProvisioning = ({
  baseUrl,
  projectId,
  token,
  displayName,
} = {}) => ({
  baseUrl: normalizeBaseUrl(baseUrl),
  projectId: normalizeProjectId(projectId),
  token: normalizeToken(token),
  displayName: nonEmptyString(displayName, 'project name'),
});

const normalizeQrProvisioning = (parsed) =>
  normalizeManualProvisioning({
    ...parsed,
    displayName: parsed.displayName ?? `Project ${parsed.projectId}`,
  });

const defaultCreateClient = ({ baseUrl, projectId, token }) =>
  new OdkCentralClient({
    baseUrl,
    projectId,
    auth: createAppUserAuth(token),
    timeoutMs: 20_000,
  });

/**
 * Verify against the public ODK Central client contract before any persistence.
 * `listForms()` is an App User/OpenRosa read endpoint and succeeds even when
 * the authorized project currently has no forms.
 */
export const verifyCentralAppUser = async (config, { createClient = defaultCreateClient } = {}) => {
  let client;
  try {
    client = createClient(config);
  } catch {
    throw failure('Could not prepare the Central connection.', {
      code: 'GATHER_PROVISIONING_VERIFY_FAILED',
      stage: 'verification',
    });
  }
  if (!client || typeof client.listForms !== 'function') {
    throw failure('Could not prepare the Central connection.', {
      code: 'GATHER_PROVISIONING_VERIFY_FAILED',
      stage: 'verification',
    });
  }
  try {
    await client.listForms();
  } catch {
    throw failure('Gather could not verify this Central project and App User token.', {
      code: 'GATHER_PROVISIONING_VERIFY_FAILED',
      stage: 'verification',
    });
  }
};

const stablePublicHash = (value) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash, 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

/** Local key derived only from public endpoint metadata; never from a token. */
export const projectKeyForCentral = ({ baseUrl, projectId }) =>
  `central-${projectId}-${stablePublicHash(baseUrl)}`;

const safeProject = (project) =>
  project
    ? {
        projectKey: project.projectKey,
        displayName: project.displayName,
        baseUrl: project.baseUrl,
        centralProjectId: project.centralProjectId,
        isActive: project.isActive,
      }
    : null;

const normalizeUsage = (usage) => {
  const toCount = (value) =>
    Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return {
    drafts: toCount(usage?.drafts),
    ready: toCount(usage?.ready),
  };
};

const warningForUsage = ({ drafts, ready }) => {
  const parts = [];
  if (drafts > 0) parts.push(`${drafts} draft${drafts === 1 ? '' : 's'}`);
  if (ready > 0) parts.push(`${ready} ready submission${ready === 1 ? '' : 's'}`);
  return parts.length === 0
    ? 'This removes this project from Gather.'
    : `This also removes ${parts.join(' and ')} stored for this project.`;
};

const attempt = async (fn) => {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
};

const assertDependencies = ({ projects, credentials, files, createClient, getProjectUsage }) => {
  if (
    !projects ||
    typeof projects.listProjects !== 'function' ||
    typeof projects.getProject !== 'function' ||
    typeof projects.upsertProject !== 'function' ||
    typeof projects.setActiveProject !== 'function' ||
    typeof projects.clearActiveProject !== 'function' ||
    typeof projects.deleteProject !== 'function' ||
    !credentials ||
    typeof credentials.getProjectToken !== 'function' ||
    typeof credentials.setProjectToken !== 'function' ||
    typeof credentials.deleteProjectCredentials !== 'function' ||
    !files ||
    typeof files.ensureProjectDirectories !== 'function' ||
    typeof files.deleteProjectDirectory !== 'function' ||
    (createClient != null && typeof createClient !== 'function') ||
    (getProjectUsage != null && typeof getProjectUsage !== 'function')
  ) {
    throw failure('Provisioning is not available yet.', {
      code: 'GATHER_PROVISIONING_UNAVAILABLE',
      stage: 'initialization',
    });
  }
};

/**
 * Orchestrates verification, metadata, project directories and SecureStore
 * credentials. It intentionally contains all storage/protocol operations so
 * route components remain presentation-only.
 */
export const createProvisioningService = (dependencies) => {
  assertDependencies(dependencies);
  const {
    projects,
    credentials,
    files,
    createClient = defaultCreateClient,
    getProjectUsage = async () => ({ drafts: 0, ready: 0 }),
    qrCodec,
  } = dependencies;

  const findExistingProject = async ({ baseUrl, projectId }) => {
    const all = await projects.listProjects();
    return (
      all.find(
        (project) =>
          project.baseUrl === baseUrl && Number(project.centralProjectId) === Number(projectId)
      ) ?? null
    );
  };

  const chooseProjectKey = async (config, existing) => {
    if (existing) return existing.projectKey;
    const base = projectKeyForCentral(config);
    let candidate = base;
    for (let suffix = 2; suffix < 1000; suffix += 1) {
      const collision = await projects.getProject(candidate);
      if (!collision) return candidate;
      candidate = `${base}-${suffix}`;
    }
    throw failure('Could not create a local project identifier.', {
      code: 'GATHER_PROVISIONING_FAILED',
      stage: 'persistence',
    });
  };

  const provision = async (config) => {
    await verifyCentralAppUser(config, { createClient });

    let existing;
    let previousActive;
    try {
      [existing, previousActive] = await Promise.all([
        findExistingProject(config),
        projects.getActiveProject ? projects.getActiveProject() : null,
      ]);
    } catch {
      throw failure('Could not prepare local project storage.', {
        code: 'GATHER_PROVISIONING_FAILED',
        stage: 'persistence',
      });
    }

    let projectKey;
    try {
      projectKey = await chooseProjectKey(config, existing);
    } catch (error) {
      if (error instanceof ProvisioningError) throw error;
      throw failure('Could not prepare local project storage.', {
        code: 'GATHER_PROVISIONING_FAILED',
        stage: 'persistence',
      });
    }
    const metadata = {
      projectKey,
      displayName: config.displayName,
      baseUrl: config.baseUrl,
      centralProjectId: config.projectId,
    };
    let previousToken = null;
    try {
      previousToken = existing ? await credentials.getProjectToken(existing.projectKey) : null;
    } catch {
      throw failure('Could not prepare local project storage.', {
        code: 'GATHER_PROVISIONING_FAILED',
        stage: 'persistence',
      });
    }
    let directoryCreated = false;
    let credentialWritten = false;
    let metadataWritten = false;

    try {
      if (!existing) {
        await files.ensureProjectDirectories(projectKey);
        directoryCreated = true;
      }
      await credentials.setProjectToken(projectKey, config.token);
      credentialWritten = true;
      await projects.upsertProject(metadata);
      metadataWritten = true;
      await projects.setActiveProject(projectKey);
      const project = await projects.getProject(projectKey);
      if (!project) {
        throw new Error('project metadata unavailable after write');
      }
      return { project: safeProject(project), created: !existing };
    } catch {
      const recovery = {};
      if (!existing) {
        if (metadataWritten) recovery.metadataRemoved = await attempt(() => projects.deleteProject(projectKey));
        if (credentialWritten) {
          recovery.credentialsRemoved = await attempt(() =>
            credentials.deleteProjectCredentials(projectKey)
          );
        }
        if (directoryCreated) {
          recovery.directoryRemoved = await attempt(() => files.deleteProjectDirectory(projectKey));
        }
      } else {
        if (metadataWritten) {
          recovery.metadataRestored = await attempt(() => projects.upsertProject(existing));
        }
        if (credentialWritten) {
          recovery.credentialsRestored = await attempt(async () => {
            if (previousToken == null) {
              await credentials.deleteProjectCredentials(projectKey);
            } else {
              await credentials.setProjectToken(projectKey, previousToken);
            }
          });
        }
        recovery.activeProjectRestored = await attempt(async () => {
          if (previousActive) {
            await projects.setActiveProject(previousActive.projectKey);
          } else {
            await projects.clearActiveProject();
          }
        });
      }
      throw failure('Project setup could not be saved. No successful connection was reported.', {
        code: 'GATHER_PROVISIONING_PERSIST_FAILED',
        stage: 'persistence',
        recovery,
      });
    }
  };

  const getRemovalPreview = async (projectKey) => {
    const project = await projects.getProject(projectKey);
    if (!project) {
      throw failure('This project is no longer available.', {
        code: 'GATHER_PROJECT_NOT_FOUND',
        stage: 'removal',
      });
    }
    let usage;
    try {
      usage = normalizeUsage(await getProjectUsage(projectKey));
    } catch {
      throw failure('Could not check stored project data before removal.', {
        code: 'GATHER_PROJECT_USAGE_FAILED',
        stage: 'removal',
      });
    }
    return {
      project: safeProject(project),
      usage,
      warning: warningForUsage(usage),
      requiresConfirmation: true,
    };
  };

  return {
    async provisionManual(input) {
      return provision(normalizeManualProvisioning(input));
    },

    async provisionQr(rawQrText) {
      let parsed;
      try {
        parsed = parseCollectSettingsQr(rawQrText, { codec: qrCodec });
      } catch (error) {
        if (error instanceof ProvisioningError) throw error;
        throw failure('This is not a supported ODK Central Settings QR code.', {
          code: 'GATHER_QR_INVALID',
          stage: 'qr-parsing',
        });
      }
      return provision(normalizeQrProvisioning(parsed));
    },

    listProjects: () => projects.listProjects().then((all) => all.map(safeProject)),

    async switchProject(projectKey) {
      try {
        return safeProject(await projects.setActiveProject(projectKey));
      } catch {
        throw failure('Could not switch projects.', {
          code: 'GATHER_PROJECT_SWITCH_FAILED',
          stage: 'switching',
        });
      }
    },

    getRemovalPreview,

    async removeProject(projectKey, { confirmed = false } = {}) {
      const preview = await getRemovalPreview(projectKey);
      if (!confirmed) return preview;

      let existing = null;
      let priorToken = null;
      let wasActive = false;
      let credentialsDeleted = false;
      let directoryDeleted = false;
      let rowDeleted = false;

      try {
        existing = await projects.getProject(projectKey);
        if (!existing) {
          throw failure('This project is no longer available.', {
            code: 'GATHER_PROJECT_NOT_FOUND',
            stage: 'removal',
          });
        }
        priorToken = await credentials.getProjectToken(projectKey);
        wasActive = existing.isActive;
        await credentials.deleteProjectCredentials(projectKey);
        credentialsDeleted = true;
        await files.deleteProjectDirectory(projectKey);
        directoryDeleted = true;
        await projects.deleteProject(projectKey);
        rowDeleted = true;

        let activeProject = null;
        if (wasActive) {
          const remaining = await projects.listProjects();
          if (remaining.length > 0) {
            activeProject = await projects.setActiveProject(remaining[0].projectKey);
          }
        } else if (projects.getActiveProject) {
          activeProject = await projects.getActiveProject();
        }
        return {
          removed: true,
          project: preview.project,
          activeProject: safeProject(activeProject),
        };
      } catch (error) {
        if (error instanceof ProvisioningError && !credentialsDeleted && !directoryDeleted && !rowDeleted) {
          throw error;
        }
        const recovery = {};
        if (rowDeleted) recovery.metadataRestored = await attempt(() => projects.upsertProject(existing));
        if (directoryDeleted) {
          recovery.directoryRecreated = await attempt(() => files.ensureProjectDirectories(projectKey));
        }
        if (credentialsDeleted && priorToken != null) {
          recovery.credentialsRestored = await attempt(() =>
            credentials.setProjectToken(projectKey, priorToken)
          );
        }
        if (wasActive) {
          recovery.activeProjectRestored = await attempt(() => projects.setActiveProject(projectKey));
        }
        throw failure('Project removal did not complete. Check the project before retrying.', {
          code: 'GATHER_PROJECT_REMOVE_FAILED',
          stage: 'removal',
          recovery,
        });
      }
    },
  };
};
