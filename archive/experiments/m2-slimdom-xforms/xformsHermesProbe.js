const { installSlimdomDomCompatibility } = require('./installDomCompatibility');
const { REPRESENTATIVE_XFORM_XML } = require('./fixtures/representative-xform');

const flattenNodes = (rootNode) => {
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    const children = node.currentState?.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        visit(child);
      }
    }
  };
  visit(rootNode);
  return nodes;
};

const findByReference = (rootNode, reference) => {
  return flattenNodes(rootNode).find((node) => node.currentState?.reference === reference) ?? null;
};

const toSerializable = (value) => {
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item));
  }
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
};

const resolveError = (error) => {
  const resolved = error instanceof Error ? error : new Error(String(error));
  return {
    name: resolved.name,
    message: resolved.message,
    stack: resolved.stack,
  };
};

const runStep = async (steps, name, operation) => {
  try {
    const value = await operation();
    steps.push({ name, ok: true, value });
    return value;
  } catch (error) {
    steps.push({ name, ok: false, error: resolveError(error) });
    return null;
  }
};

const runSlimdomXformsHermesProbe = async () => {
  const steps = [];
  let restoreCompatibility = null;

  try {
    const compatibility = await runStep(steps, 'install slimdom compatibility', async () =>
      installSlimdomDomCompatibility({ force: true })
    );
    if (compatibility == null) {
      return { ok: false, steps };
    }
    restoreCompatibility = compatibility.restore;

    const xformsEngine = await runStep(
      steps,
      'import @getodk/xforms-engine (dist entry for Metro/Hermes)',
      async () => require('@getodk/xforms-engine/dist/index.js')
    );
    if (xformsEngine == null) {
      return { ok: false, steps };
    }

    const loadResult = await runStep(steps, 'loadForm representative fixture', async () =>
      xformsEngine.loadForm(REPRESENTATIVE_XFORM_XML)
    );
    if (loadResult == null) {
      return { ok: false, steps };
    }

    const loadStatus = loadResult.status;
    const loadError = loadResult.status === 'failure' ? loadResult.error?.message ?? 'unknown' : null;
    steps.push({
      name: 'loadForm status check',
      ok: loadResult.status !== 'failure',
      value: { status: loadStatus, error: loadError },
    });
    if (loadResult.status === 'failure') {
      return { ok: false, steps };
    }

    const instance = await runStep(steps, 'createInstance', async () => loadResult.createInstance());
    if (instance == null) {
      return { ok: false, steps };
    }

    const root = instance.root;

    const stateInspection = await runStep(steps, 'inspect initial state', async () => ({
      rootNodeType: root.nodeType,
      ageValue: toSerializable(findByReference(root, '/data/age')?.currentState?.value),
      calcValue: toSerializable(findByReference(root, '/data/calc')?.currentState?.value),
      extraRelevant: findByReference(root, '/data/extra')?.currentState?.relevant ?? null,
      repeatCount:
        flattenNodes(root).find((node) => node.nodeType === 'repeat-range:uncontrolled')?.currentState
          ?.children.length ?? null,
    }));
    if (stateInspection == null) {
      return { ok: false, steps };
    }

    const setValueResult = await runStep(steps, 'set value + compute checks', async () => {
      findByReference(root, '/data/age')?.setValue('19');
      findByReference(root, '/data/height')?.setValue('2.5');
      findByReference(root, '/data/show_extra')?.setValue('1');
      findByReference(root, '/data/choice')?.selectValue('apple');

      const calcNode = findByReference(root, '/data/calc');
      const extraNode = findByReference(root, '/data/extra');
      const choiceNode = findByReference(root, '/data/choice');

      findByReference(root, '/data/age')?.setValue('17');
      const ageNode = findByReference(root, '/data/age');

      return {
        calcValue: toSerializable(calcNode?.currentState?.value),
        extraRelevant: extraNode?.currentState?.relevant ?? null,
        selectedValues: toSerializable(choiceNode?.currentState?.value),
        ageConstraintValid:
          ageNode?.validationState != null && 'constraint' in ageNode.validationState
            ? ageNode.validationState.constraint.valid
            : null,
        ageViolation:
          ageNode?.validationState != null && 'violation' in ageNode.validationState
            ? ageNode.validationState.violation?.condition ?? null
            : null,
      };
    });
    if (setValueResult == null) {
      return { ok: false, steps };
    }

    const repeatMutationResult = await runStep(steps, 'repeat add/remove check', async () => {
      const repeatRange = flattenNodes(root).find((node) => node.nodeType === 'repeat-range:uncontrolled');
      if (repeatRange == null) {
        throw new Error('Expected repeat-range:uncontrolled node');
      }

      const before = repeatRange.currentState.children.length;
      repeatRange.addInstances();
      const afterAdd = repeatRange.currentState.children.length;
      findByReference(root, '/data/rep[2]/note')?.setValue('Second note');
      findByReference(root, '/data/rep[2]/qty')?.setValue('2');
      repeatRange.removeInstances(1);
      const afterRemove = repeatRange.currentState.children.length;

      return { before, afterAdd, afterRemove };
    });
    if (repeatMutationResult == null) {
      return { ok: false, steps };
    }

    await runStep(steps, 'prepare serialized payload', async () => {
      const payload = await root.prepareInstancePayload();
      const instanceFile = payload.data[0].get('xml_submission_file');
      const instanceXml = await instanceFile.text();
      return {
        status: payload.status,
        violationCount: payload.violations == null ? null : payload.violations.length,
        containsDataTag: instanceXml.includes('<data id="m2_slimdom_fixture">'),
        normalizedInstanceXml: instanceXml.replace(/uuid:[^<]+/g, 'uuid:__INSTANCE_ID__'),
      };
    });
  } finally {
    if (restoreCompatibility != null) {
      restoreCompatibility();
    }
  }

  return {
    ok: steps.every((step) => step.ok),
    steps,
  };
};

module.exports = {
  runSlimdomXformsHermesProbe,
};
