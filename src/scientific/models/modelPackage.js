import { ScientificContractError, revisionFor, sha256For } from '../contracts.js';

export const TASK_PROFILES = Object.freeze({
  segmentationBinary: 'segmentation.binary.v1',
  classificationRanked: 'classification.ranked.v1',
});

const supportedPreprocess = new Set(['resize', 'crop', 'colorConvert', 'scale', 'normalize', 'tensorLayout']);
const supportedPostprocess = new Set(['sigmoid', 'softmax', 'threshold', 'argmax', 'topK', 'binaryMask', 'restoreSourceSize']);
const supportedProfiles = new Set(Object.values(TASK_PROFILES));

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const assert = (condition, message) => {
  if (!condition) throw new ScientificContractError(message, { code: 'GATHER_MODEL_PACKAGE_INVALID' });
};

const assertSteps = (steps, supported, field) => {
  assert(Array.isArray(steps), `${field} must be an array.`);
  steps.forEach((step) => {
    assert(isObject(step) && typeof step.operation === 'string', `${field} steps must declare an operation.`);
    assert(supported.has(step.operation), `${field} operation "${step.operation}" is not supported.`);
  });
};

const assertDigest = (digest, field) =>
  assert(typeof digest === 'string' && /^sha256:[a-f0-9]{64}$/.test(digest), `${field} must be a SHA-256 digest.`);

export const validateScientificModelPackage = (modelPackage) => {
  assert(isObject(modelPackage), 'Scientific Model Package must be an object.');
  const { identity, artifact, tensor, preprocessing, postprocessing, upstream, taskProfile } = modelPackage;
  assert(isObject(identity), 'Model identity is required.');
  assert(typeof identity.id === 'string' && identity.id.length > 0, 'Model identity.id is required.');
  assert(typeof identity.version === 'string' && identity.version.length > 0, 'Model identity.version is required.');
  assert(supportedProfiles.has(taskProfile), `Unsupported task profile "${taskProfile}".`);
  assert(isObject(artifact) && typeof artifact.path === 'string' && artifact.path.length > 0, 'Model artifact.path is required.');
  assertDigest(artifact.sha256, 'Model artifact.sha256');
  assert(isObject(tensor) && typeof tensor.inputName === 'string', 'Model tensor.inputName is required.');
  assert(Array.isArray(tensor.inputShape), 'Model tensor.inputShape is required.');
  assert(Array.isArray(tensor.outputNames) && tensor.outputNames.length > 0, 'Model tensor.outputNames is required.');
  assert(isObject(upstream) && typeof upstream.project === 'string' && typeof upstream.revision === 'string', 'Model upstream provenance is required.');
  assertSteps(preprocessing, supportedPreprocess, 'Model preprocessing');
  assertSteps(postprocessing, supportedPostprocess, 'Model postprocessing');

  if (taskProfile === TASK_PROFILES.segmentationBinary) {
    assert(postprocessing.some((step) => step.operation === 'binaryMask'), 'Binary segmentation requires binaryMask postprocessing.');
  }
  if (taskProfile === TASK_PROFILES.classificationRanked) {
    assert(postprocessing.some((step) => step.operation === 'topK'), 'Ranked classification requires topK postprocessing.');
    assert(isObject(modelPackage.labels) && typeof modelPackage.labels.path === 'string', 'Ranked classification requires labels.');
    assertDigest(modelPackage.labels.sha256, 'Model labels.sha256');
  }

  return modelPackage;
};

export const modelRevisionFor = (modelPackage) => {
  const copy = { ...validateScientificModelPackage(modelPackage), identity: { ...modelPackage.identity } };
  delete copy.identity.revision;
  return revisionFor(copy);
};

export const createScientificModelRef = (modelPackage) => {
  validateScientificModelPackage(modelPackage);
  return {
    id: modelPackage.identity.id,
    version: modelPackage.identity.version,
    revision: modelRevisionFor(modelPackage),
    artifactSha256: modelPackage.artifact.sha256,
    taskProfile: modelPackage.taskProfile,
  };
};

export const modelArtifactDigestFor = (bytes) => sha256For(bytes);
