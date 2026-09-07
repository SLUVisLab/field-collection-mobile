import { DOMParser, XMLSerializer } from '@oozcitak/dom';

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
    const value = fn();
    return { name, ok: true, value };
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

const matchesIssue22Pattern = (message) => {
  return /read only property|cannot assign to read only property/i.test(message);
};

export const runOozcitakHermesGateProbe = () => {
  const steps = [];

  const parserStep = runStep('new DOMParser()', () => new DOMParser());
  steps.push(parserStep);

  if (!parserStep.ok) {
    return {
      ok: false,
      issue22Reproduced: matchesIssue22Pattern(parserStep.error.message),
      steps,
    };
  }

  const parser = parserStep.value;
  const parseStep = runStep('parseFromString(text/xml)', () =>
    parser.parseFromString(XML_FIXTURE, 'text/xml')
  );
  steps.push(parseStep);

  if (!parseStep.ok) {
    return {
      ok: false,
      issue22Reproduced: matchesIssue22Pattern(parseStep.error.message),
      steps,
    };
  }

  const document = parseStep.value;
  const rootStep = runStep('document.documentElement', () => {
    if (document.documentElement == null) {
      throw new Error('documentElement is null');
    }
    return {
      localName: document.documentElement.localName,
      namespaceURI: document.documentElement.namespaceURI,
      prefix: document.documentElement.prefix,
      nodeType: document.documentElement.nodeType,
      nodeName: document.documentElement.nodeName,
    };
  });
  steps.push(rootStep);

  const classFieldRiskSteps = [
    runStep('document.implementation', () => document.implementation),
    runStep('document.createAttribute("risk_attr")', () => document.createAttribute('risk_attr')),
    runStep('document.createComment("risk")', () => document.createComment('risk')),
    runStep('document.createTextNode("risk")', () => document.createTextNode('risk')),
    runStep('document.createDocumentFragment()', () => document.createDocumentFragment()),
  ];
  steps.push(...classFieldRiskSteps);

  const createElementStep = runStep('document.createElement("probe")', () =>
    document.createElement('probe')
  );
  steps.push(createElementStep);
  if (!createElementStep.ok) {
    return {
      ok: false,
      issue22Reproduced: matchesIssue22Pattern(createElementStep.error.message),
      steps,
    };
  }

  const createElementNSStep = runStep(
    'document.createElementNS("urn:probe","p:probe")',
    () => document.createElementNS('urn:probe', 'p:probe')
  );
  steps.push(createElementNSStep);
  if (!createElementNSStep.ok) {
    return {
      ok: false,
      issue22Reproduced: matchesIssue22Pattern(createElementNSStep.error.message),
      steps,
    };
  }

  const probeElement = createElementStep.value;
  const probeNsElement = createElementNSStep.value;

  steps.push(
    runStep('element metadata', () => ({
      localName: probeNsElement.localName,
      namespaceURI: probeNsElement.namespaceURI,
      prefix: probeNsElement.prefix,
      nodeType: probeNsElement.nodeType,
      nodeName: probeNsElement.nodeName,
    }))
  );

  steps.push(
    runStep('setAttribute + setAttributeNS', () => {
      probeElement.setAttribute('a', '1');
      probeNsElement.setAttributeNS('urn:probe', 'p:flag', 'yes');
      const attr = probeNsElement.getAttributeNodeNS('urn:probe', 'flag');
      if (attr == null) {
        throw new Error('Expected namespaced attribute to be present');
      }
      return {
        attrLocalName: attr.localName,
        attrNamespaceURI: attr.namespaceURI,
        attrPrefix: attr.prefix,
      };
    })
  );

  steps.push(
    runStep('appendChild / append', () => {
      const root = document.documentElement;
      if (root == null) {
        throw new Error('documentElement is null');
      }

      root.appendChild(probeElement);
      let appendSupported = false;
      if (typeof root.append === 'function') {
        root.append(probeNsElement);
        appendSupported = true;
      } else {
        root.appendChild(probeNsElement);
      }

      return {
        childCount: root.childNodes.length,
        appendSupported,
      };
    })
  );

  const serializerStep = runStep('new XMLSerializer()', () => new XMLSerializer());
  steps.push(serializerStep);
  if (!serializerStep.ok) {
    return {
      ok: false,
      issue22Reproduced: matchesIssue22Pattern(serializerStep.error.message),
      steps,
    };
  }

  const serializer = serializerStep.value;
  const serializeStep = runStep('serializeToString(document)', () =>
    serializer.serializeToString(document)
  );
  steps.push(serializeStep);

  const issue22Reproduced = steps.some((step) => {
    if (step.ok) {
      return false;
    }
    return matchesIssue22Pattern(step.error.message);
  });

  return {
    ok: steps.every((step) => step.ok),
    issue22Reproduced,
    steps,
    fixtureLength: XML_FIXTURE.length,
  };
};

