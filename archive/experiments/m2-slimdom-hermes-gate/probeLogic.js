const { DOMParser, XMLSerializer } = require('slimdom');

const XML_FIXTURE = `<h:html
  xmlns:h="http://www.w3.org/1999/xhtml"
  xmlns="http://www.w3.org/2002/xforms"
  xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <model>
      <instance>
        <data>
          <plant_id>p-001</plant_id>
        </data>
      </instance>
    </model>
  </h:head>
</h:html>`;

const runStep = (name, fn) => {
  try {
    return { name, ok: true, value: fn() };
  } catch (error) {
    const resolvedError =
      error instanceof Error ? error : new Error(`Unknown error in step "${name}"`);
    return {
      name,
      ok: false,
      error: {
        name: resolvedError.name,
        message: resolvedError.message,
        stack: resolvedError.stack,
      },
    };
  }
};

const summarizeValue = (value) => {
  if (value == null) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((entry) => summarizeValue(entry));
  }
  if (typeof value === 'object') {
    if (typeof value.nodeType === 'number' && typeof value.nodeName === 'string') {
      return {
        nodeType: value.nodeType,
        nodeName: value.nodeName,
        localName: value.localName ?? null,
      };
    }
    if (value.constructor?.name != null) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return { type: value.constructor.name };
      }
    }
  }
  return String(value);
};

const sanitizeSteps = (steps) =>
  steps.map((step) => {
    if (!step.ok) {
      return step;
    }
    if (!Object.prototype.hasOwnProperty.call(step, 'value')) {
      return step;
    }
    return {
      ...step,
      value: summarizeValue(step.value),
    };
  });

const makeResult = ({
  ok,
  runtimeLabel,
  fixtureLength,
  observations,
  knownGapChecks,
  unsupported,
  steps,
}) => ({
  ok,
  runtimeLabel,
  fixtureLength,
  observations,
  knownGapChecks,
  unsupportedApis: [...unsupported].sort(),
  steps: sanitizeSteps(steps),
});

const addUnsupported = (set, apiName) => {
  set.add(apiName);
};

const getRequired = (value, message) => {
  if (value == null) {
    throw new Error(message);
  }
  return value;
};

const runDomProbe = (constructors, runtimeLabel) => {
  const steps = [];
  const observations = {};
  const unsupported = new Set();

  const parserStep = runStep('new DOMParser()', () => new constructors.DOMParser());
  steps.push(parserStep);
  if (!parserStep.ok) {
    return makeResult({
      ok: false,
      runtimeLabel,
      fixtureLength: XML_FIXTURE.length,
      knownGapChecks: null,
      steps,
      observations,
      unsupported,
    });
  }

  const parser = parserStep.value;
  const parseStep = runStep('parseFromString(text/xml)', () =>
    parser.parseFromString(XML_FIXTURE, 'text/xml')
  );
  steps.push(parseStep);
  if (!parseStep.ok) {
    return makeResult({
      ok: false,
      runtimeLabel,
      fixtureLength: XML_FIXTURE.length,
      knownGapChecks: null,
      steps,
      observations,
      unsupported,
    });
  }

  const document = parseStep.value;
  const root = document.documentElement;
  if (root == null) {
    steps.push(
      runStep('document.documentElement', () => {
        throw new Error('documentElement is null');
      })
    );
    return {
      ...makeResult({
        ok: false,
        runtimeLabel,
        fixtureLength: XML_FIXTURE.length,
        knownGapChecks: null,
        steps,
        observations,
        unsupported,
      }),
    };
  }

  observations.parsing = {
    rootLocalName: root.localName,
    rootNamespaceURI: root.namespaceURI,
    rootPrefix: root.prefix,
    nodeType: root.nodeType,
    nodeName: root.nodeName,
  };
  steps.push(runStep('document.documentElement metadata', () => observations.parsing));

  const namespaceStep = runStep('namespace and attribute operations', () => {
    const probe = document.createElementNS('urn:probe-element', 'p:probe');
    probe.setAttributeNS('urn:probe-attr', 'a:flag', 'yes');
    const attr = getRequired(
      probe.getAttributeNodeNS('urn:probe-attr', 'flag'),
      'Expected namespaced attribute to exist'
    );

    root.appendChild(probe);

    return {
      rootLocalName: root.localName,
      rootNamespaceURI: root.namespaceURI,
      rootPrefix: root.prefix,
      lookupPrefixXhtml: root.lookupPrefix('http://www.w3.org/1999/xhtml'),
      lookupNamespaceUriH: root.lookupNamespaceURI('h'),
      lookupNamespaceUriDefault: root.lookupNamespaceURI(null),
      createdElement: {
        localName: probe.localName,
        namespaceURI: probe.namespaceURI,
        prefix: probe.prefix,
      },
      attribute: {
        localName: attr.localName,
        namespaceURI: attr.namespaceURI,
        prefix: attr.prefix,
        value: attr.value,
      },
      getAttributeNsValue: probe.getAttributeNS('urn:probe-attr', 'flag'),
    };
  });
  steps.push(namespaceStep);
  if (namespaceStep.ok) {
    observations.namespaces = namespaceStep.value;
  }

  const treeStep = runStep('tree behavior checks', () => {
    const rootFirstElement = getRequired(root.firstElementChild, 'Expected firstElementChild');
    const rootLastElement = getRequired(root.lastElementChild, 'Expected lastElementChild');
    const clone = root.cloneNode(true);

    return {
      childNodesLength: root.childNodes.length,
      childrenLength: root.children ? root.children.length : null,
      ownerDocumentMatches: rootFirstElement.ownerDocument === document,
      firstChildNodeType: root.firstChild ? root.firstChild.nodeType : null,
      firstElementChildLocalName: rootFirstElement.localName,
      lastElementChildLocalName: rootLastElement.localName,
      cloneNodeName: clone.nodeName,
      cloneChildNodesLength: clone.childNodes.length,
    };
  });
  steps.push(treeStep);
  if (treeStep.ok) {
    observations.tree = treeStep.value;
  }

  const mutationStep = runStep('mutation API checks', () => {
    const mutationParent = document.createElementNS('urn:mut', 'm:parent');
    const childA = document.createElementNS('urn:mut', 'm:a');
    const childB = document.createElementNS('urn:mut', 'm:b');
    const replacement = document.createElementNS('urn:mut', 'm:replacement');

    root.appendChild(mutationParent);

    if (typeof mutationParent.append === 'function') {
      mutationParent.append(childA);
    } else {
      addUnsupported(unsupported, 'Element.append');
      mutationParent.appendChild(childA);
    }

    if (typeof mutationParent.prepend === 'function') {
      mutationParent.prepend(childB);
    } else {
      addUnsupported(unsupported, 'Element.prepend');
      mutationParent.insertBefore(childB, mutationParent.firstChild);
    }

    if (typeof childA.remove === 'function') {
      childA.remove();
    } else {
      addUnsupported(unsupported, 'Element.remove');
      mutationParent.removeChild(childA);
    }

    if (typeof childB.replaceWith === 'function') {
      childB.replaceWith(replacement);
    } else {
      addUnsupported(unsupported, 'Element.replaceWith');
      mutationParent.replaceChild(replacement, childB);
    }

    mutationParent.setAttribute('plain', '1');
    mutationParent.setAttributeNS('urn:mut-attr', 'ma:flag', 'ns-value');

    return {
      childElementCount: mutationParent.children ? mutationParent.children.length : null,
      firstElementChildLocalName: mutationParent.firstElementChild
        ? mutationParent.firstElementChild.localName
        : null,
      plainAttribute: mutationParent.getAttribute('plain'),
      namespacedAttribute: mutationParent.getAttributeNS('urn:mut-attr', 'flag'),
    };
  });
  steps.push(mutationStep);
  if (mutationStep.ok) {
    observations.mutation = mutationStep.value;
  }

  const serializerStep = runStep('new XMLSerializer()', () => new constructors.XMLSerializer());
  steps.push(serializerStep);
  if (!serializerStep.ok) {
    return makeResult({
      ok: false,
      runtimeLabel,
      fixtureLength: XML_FIXTURE.length,
      knownGapChecks: null,
      steps,
      observations,
      unsupported,
    });
  }

  const serializer = serializerStep.value;
  const serializationStep = runStep('serializeToString and round-trip parse', () => {
    const serialized = serializer.serializeToString(document);
    const roundTripDocument = parser.parseFromString(serialized, 'text/xml');
    const roundTripRoot = getRequired(
      roundTripDocument.documentElement,
      'Round-trip documentElement missing'
    );

    return {
      serializedLength: serialized.length,
      containsXhtmlNamespace: serialized.includes('http://www.w3.org/1999/xhtml'),
      containsXformsNamespace: serialized.includes('http://www.w3.org/2002/xforms'),
      containsJrNamespace: serialized.includes('http://openrosa.org/javarosa'),
      containsMutNsAttribute: serialized.includes('ma:flag'),
      roundTripRootLocalName: roundTripRoot.localName,
      roundTripRootPrefix: roundTripRoot.prefix,
      roundTripRootNamespaceURI: roundTripRoot.namespaceURI,
      roundTripLookupNamespaceUriH: roundTripRoot.lookupNamespaceURI('h'),
      roundTripTextContentIncludesPlant: roundTripRoot.textContent.includes('p-001'),
    };
  });
  steps.push(serializationStep);
  if (serializationStep.ok) {
    observations.serialization = serializationStep.value;
  }

  const knownGapChecks = {
    elementMatches: typeof root.matches === 'function',
    elementQuerySelector: typeof root.querySelector === 'function',
    elementQuerySelectorAll: typeof root.querySelectorAll === 'function',
    documentCurrentScript: 'currentScript' in document,
  };

  const unsupportedGapApis = Object.entries(knownGapChecks)
    .filter(([, isPresent]) => !isPresent)
    .map(([api]) => api);
  for (const api of unsupportedGapApis) {
    addUnsupported(unsupported, api);
  }

  const ok = steps.every((step) => step.ok);
  return makeResult({
    ok,
    runtimeLabel,
    fixtureLength: XML_FIXTURE.length,
    observations,
    knownGapChecks,
    unsupported,
    steps,
  });
};

const runSlimdomHermesGateProbe = () =>
  runDomProbe(
    {
      DOMParser,
      XMLSerializer,
    },
    'slimdom'
  );

module.exports = {
  XML_FIXTURE,
  runDomProbe,
  runSlimdomHermesGateProbe,
};
