const { REPRESENTATIVE_XFORM_XML } = require('./fixtures/representative-xform');

const normalizeScalar = (value) => {
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeScalar(item));
  }
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if ('asString' in value && typeof value.asString === 'string') {
      return value.asString;
    }
  }
  return String(value);
};

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

const findNodeByReference = (rootNode, reference) => {
  return flattenNodes(rootNode).find((node) => node.currentState?.reference === reference) ?? null;
};

const summarizeNode = (node) => {
  if (node == null) {
    return null;
  }

  const valueOptions = Array.isArray(node.currentState?.valueOptions)
    ? node.currentState.valueOptions.map((item) => ({
        label: item.label?.asString ?? null,
        value: item.value,
      }))
    : null;

  const validation = node.validationState;
  const constraintValid =
    validation != null && 'constraint' in validation ? validation.constraint.valid : null;
  const requiredValid =
    validation != null && 'required' in validation ? validation.required.valid : null;
  const violationCondition =
    validation != null && 'violation' in validation ? validation.violation?.condition ?? null : null;

  return {
    nodeType: node.nodeType,
    reference: node.currentState?.reference ?? null,
    value: normalizeScalar(node.currentState?.value),
    relevant: node.currentState?.relevant ?? null,
    required: node.currentState?.required ?? null,
    readonly: node.currentState?.readonly ?? null,
    constraintValid,
    requiredValid,
    violationCondition,
    valueOptions,
  };
};

const summarizeSnapshot = (rootNode) => {
  const references = [
    '/data/name',
    '/data/age',
    '/data/height',
    '/data/calc',
    '/data/show_extra',
    '/data/extra',
    '/data/choice',
    '/data/rep[1]/note',
    '/data/rep[1]/qty',
    '/data/rep[2]/note',
    '/data/rep[2]/qty',
  ];

  const nodes = Object.fromEntries(
    references.map((reference) => [reference, summarizeNode(findNodeByReference(rootNode, reference))])
  );

  const repeatRangeNode =
    flattenNodes(rootNode).find((node) => String(node.nodeType).startsWith('repeat-range')) ?? null;

  return {
    nodes,
    repeatRange: repeatRangeNode
      ? {
          nodeType: repeatRangeNode.nodeType,
          reference: repeatRangeNode.currentState.reference,
          count: repeatRangeNode.currentState.children.length,
        }
      : null,
    rootViolationsCount:
      rootNode.validationState != null && 'violations' in rootNode.validationState
        ? rootNode.validationState.violations.length
        : null,
  };
};

const normalizeSerializedInstanceXml = (xml) => {
  return xml
    .replace(/uuid:[^<]+/g, 'uuid:__INSTANCE_ID__')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
};

const runXformsScenario = async ({ loadForm }) => {
  const result = await loadForm(REPRESENTATIVE_XFORM_XML);
  if (result.status === 'failure') {
    return {
      loadStatus: result.status,
      loadError: result.error?.message ?? 'Unknown load error',
      snapshots: null,
      payload: null,
    };
  }

  const instance = result.createInstance();
  const root = instance.root;

  const initial = summarizeSnapshot(root);

  findNodeByReference(root, '/data/name')?.setValue('Alice');
  findNodeByReference(root, '/data/age')?.setValue('19');
  findNodeByReference(root, '/data/height')?.setValue('2.5');
  findNodeByReference(root, '/data/show_extra')?.setValue('1');
  findNodeByReference(root, '/data/choice')?.selectValue('apple');
  const afterPrimaryUpdates = summarizeSnapshot(root);

  findNodeByReference(root, '/data/age')?.setValue('17');
  const afterConstraintChange = summarizeSnapshot(root);

  const repeatRange =
    flattenNodes(root).find((node) => node.nodeType === 'repeat-range:uncontrolled') ?? null;
  if (repeatRange != null) {
    repeatRange.addInstances();
    findNodeByReference(root, '/data/rep[2]/note')?.setValue('Second note');
    findNodeByReference(root, '/data/rep[2]/qty')?.setValue('2');
    repeatRange.removeInstances(1);
  }
  const afterRepeatMutation = summarizeSnapshot(root);

  const payload = await root.prepareInstancePayload();
  const instanceFile = payload.data[0].get('xml_submission_file');
  const payloadXml = await instanceFile.text();

  return {
    loadStatus: result.status,
    loadError: null,
    snapshots: {
      initial,
      afterPrimaryUpdates,
      afterConstraintChange,
      afterRepeatMutation,
    },
    payload: {
      status: payload.status,
      violationCount: payload.violations == null ? null : payload.violations.length,
      instanceXml: payloadXml,
      normalizedInstanceXml: normalizeSerializedInstanceXml(payloadXml),
    },
  };
};

module.exports = {
  runXformsScenario,
  normalizeSerializedInstanceXml,
};
