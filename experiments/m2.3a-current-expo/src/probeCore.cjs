const { installSlimdomDomCompatibility } = require('./installDomCompatibility.cjs');
const { REPRESENTATIVE_XFORM_XML } = require('./representativeXform.cjs');

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

const serializeValue = (value) => {
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
};

const toError = (error) => {
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
    steps.push({ name, ok: false, error: toError(error) });
    return null;
  }
};

const runXformsProbeWithLoadForm = async (loadForm, importMode) => {
  const steps = [];
  let restoreCompatibility = null;

  try {
    const compatibility = await runStep(steps, 'slimdom compatibility init', async () =>
      installSlimdomDomCompatibility({ force: true })
    );
    if (compatibility == null) {
      return { ok: false, importMode, steps };
    }
    restoreCompatibility = compatibility.restore;

    const loadResult = await runStep(steps, 'loadForm representative fixture', async () =>
      loadForm(REPRESENTATIVE_XFORM_XML)
    );
    if (loadResult == null) {
      return { ok: false, importMode, steps };
    }

    const loadStatusOk = loadResult.status !== 'failure';
    steps.push({
      name: 'loadForm status',
      ok: loadStatusOk,
      value: {
        status: loadResult.status,
        error: loadResult.status === 'failure' ? loadResult.error?.message ?? 'unknown' : null,
      },
    });
    if (!loadStatusOk) {
      return { ok: false, importMode, steps };
    }

    const instance = await runStep(steps, 'createInstance', async () => loadResult.createInstance());
    if (instance == null) {
      return { ok: false, importMode, steps };
    }

    const root = instance.root;

    await runStep(steps, 'inspect known state', async () => ({
      rootNodeType: root.nodeType,
      ageValue: serializeValue(findByReference(root, '/data/age')?.currentState?.value),
      calcValue: serializeValue(findByReference(root, '/data/calc')?.currentState?.value),
      extraRelevant: findByReference(root, '/data/extra')?.currentState?.relevant ?? null,
    }));

    await runStep(steps, 'setValue and dependent behavior', async () => {
      findByReference(root, '/data/age')?.setValue('19');
      findByReference(root, '/data/height')?.setValue('2.5');
      findByReference(root, '/data/show_extra')?.setValue('1');
      findByReference(root, '/data/choice')?.selectValue('apple');

      const calcNode = findByReference(root, '/data/calc');
      const extraNode = findByReference(root, '/data/extra');
      const ageNode = findByReference(root, '/data/age');
      ageNode?.setValue('17');

      return {
        calcValue: serializeValue(calcNode?.currentState?.value),
        extraRelevant: extraNode?.currentState?.relevant ?? null,
        ageConstraintValid:
          ageNode?.validationState != null && 'constraint' in ageNode.validationState
            ? ageNode.validationState.constraint.valid
            : null,
      };
    });

    await runStep(steps, 'serialize instance payload', async () => {
      const payload = await root.prepareInstancePayload();
      const instanceFile = payload.data[0].get('xml_submission_file');
      const xml = await instanceFile.text();
      return {
        status: payload.status,
        violationCount: payload.violations == null ? null : payload.violations.length,
        hasFixtureRoot: xml.includes('<data id="m2_3a_fixture">'),
      };
    });
  } finally {
    restoreCompatibility?.();
  }

  return {
    ok: steps.every((step) => step.ok),
    importMode,
    steps,
  };
};

module.exports = {
  runXformsProbeWithLoadForm,
};
