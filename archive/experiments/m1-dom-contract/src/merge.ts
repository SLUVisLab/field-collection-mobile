import fs from 'node:fs';
import path from 'node:path';
import { DOMParser as OozDomParser, XMLSerializer as OozXmlSerializer } from '@oozcitak/dom';
import { DOMParser as SlimDomParser, XMLSerializer as SlimDomSerializer } from 'slimdom';
import { DOMParser as XmlDomParser, XMLSerializer as XmlDomSerializer } from '@xmldom/xmldom';
import { DOMParser as LinkeDomParser, parseHTML as parseLinkedomHTML } from 'linkedom';
import { JSDOM } from 'jsdom';
import type { DynamicArtifact, RequirementRecord, StaticArtifact, UsageKind } from './types.js';
import { classifyCategories, outDir, readJson, writeJson } from './utils.js';

interface ContractRequirement {
  interface: string;
  member: string;
  categories: string[];
  usageKinds: UsageKind[];
  staticReferenced: boolean;
  dynamicObserved: boolean;
  dynamicCount: number;
  sourcePackages: string[];
  sources: string[];
  dynamicSampleStacks: string[];
}

interface NormalizedRequirement extends Omit<ContractRequirement, 'interface'> {
  interface: string;
  interfacesObserved: string[];
  dynamicAttribution: ('A' | 'B' | 'C')[];
}

interface ContractArtifact {
  metadata: {
    generatedAt: string;
    engineVersion: string;
    xpathMode: 'vendored-source' | 'bundled-dist-only';
    staticRequirements: number;
    dynamicRequirements: number;
    dynamicStatus: 'ok' | 'error' | 'missing';
    dynamicError?: string;
  };
  requirements: ContractRequirement[];
}

interface CandidateContext {
  constructors: Record<string, Function | undefined>;
  instances: Record<string, unknown>;
}

interface CandidateCoverage {
  name: string;
  raw: {
    supported: number;
    total: number;
    coverage: number;
    unsupported: string[];
  };
  portable: {
    supported: number;
    total: number;
    coverage: number;
    unsupported: string[];
    severity: {
      critical: string[];
      important: string[];
      easyShim: string[];
    };
  };
}

interface DynamicOnlyAttribution {
  interface: string;
  member: string;
  classification: 'A' | 'B' | 'C';
  rationale: string;
  evidenceFrames: string[];
  dynamicCount: number;
}

interface PortableContractArtifact {
  metadata: {
    generatedAt: string;
    basedOn: string;
    staticRequirements: number;
    dynamicRequirements: number;
    normalizedRequirements: number;
    portableRequirements: number;
  };
  requirements: NormalizedRequirement[];
}

interface ObservedContractArtifact extends ContractArtifact {
  normalizedRequirements: NormalizedRequirement[];
  dynamicOnlyAttribution: DynamicOnlyAttribution[];
}

const staticPath = path.join(outDir, 'static-dom-usage.json');
const dynamicPath = path.join(outDir, 'dynamic-dom-usage.json');
const contractPath = path.join(outDir, 'dom-contract.json');
const summaryPath = path.join(outDir, 'dom-contract.md');
const candidatesPath = path.join(outDir, 'candidates.md');
const observedContractPath = path.join(outDir, 'observed-reference-contract.json');
const observedSummaryPath = path.join(outDir, 'observed-reference-contract.md');
const portableContractPath = path.join(outDir, 'portable-required-contract.json');
const portableSummaryPath = path.join(outDir, 'portable-required-contract.md');

const getRequirementKey = (interfaceName: string, memberName: string): string =>
  `${interfaceName}::${memberName}`;

const normalizeRequirement = (
  requirement: RequirementRecord
): ContractRequirement => {
  return {
    interface: requirement.interface,
    member: requirement.member,
    categories: requirement.categories,
    usageKinds: requirement.usageKinds,
    staticReferenced: true,
    dynamicObserved: false,
    dynamicCount: 0,
    sourcePackages: requirement.sourcePackages,
    sources: requirement.sources,
    dynamicSampleStacks: [],
  };
};

const mergeArtifacts = (staticArtifact: StaticArtifact, dynamicArtifact?: DynamicArtifact): ContractArtifact => {
  const requirementMap = new Map<string, ContractRequirement>();

  for (const requirement of staticArtifact.requirements) {
    requirementMap.set(
      getRequirementKey(requirement.interface, requirement.member),
      normalizeRequirement(requirement)
    );
  }

  if (dynamicArtifact != null) {
    const includeDynamicOnly = dynamicArtifact.metadata.status === 'ok';

    for (const dynamicRequirement of dynamicArtifact.requirements) {
      const key = getRequirementKey(dynamicRequirement.interface, dynamicRequirement.member);
      const existing = requirementMap.get(key);

      if (existing != null) {
        existing.dynamicObserved = true;
        existing.dynamicCount += dynamicRequirement.count;
        existing.dynamicSampleStacks = Array.from(
          new Set([...existing.dynamicSampleStacks, ...dynamicRequirement.sampleStacks])
        );
        existing.usageKinds = Array.from(
          new Set([...existing.usageKinds, ...dynamicRequirement.usageKinds])
        ).sort((a, b) => a.localeCompare(b)) as UsageKind[];
        continue;
      }

      if (!includeDynamicOnly) {
        continue;
      }

      requirementMap.set(key, {
        interface: dynamicRequirement.interface,
        member: dynamicRequirement.member,
        categories: classifyCategories(dynamicRequirement.interface, dynamicRequirement.member),
        usageKinds: dynamicRequirement.usageKinds,
        staticReferenced: false,
        dynamicObserved: true,
        dynamicCount: dynamicRequirement.count,
        sourcePackages: ['dynamic-only'],
        sources: [],
        dynamicSampleStacks: dynamicRequirement.sampleStacks,
      });
    }
  }

  const requirements = Array.from(requirementMap.values()).sort((a, b) => {
    const interfaceOrder = a.interface.localeCompare(b.interface);
    if (interfaceOrder !== 0) {
      return interfaceOrder;
    }
    return a.member.localeCompare(b.member);
  });

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      engineVersion: staticArtifact.metadata.engineVersion,
      xpathMode: staticArtifact.metadata.xpathMode,
      staticRequirements: staticArtifact.requirements.length,
      dynamicRequirements: dynamicArtifact?.requirements.length ?? 0,
      dynamicStatus: dynamicArtifact?.metadata.status ?? 'missing',
      ...(dynamicArtifact?.metadata.error == null
        ? {}
        : {
            dynamicError: `${dynamicArtifact.metadata.error.name}: ${dynamicArtifact.metadata.error.message}`,
          }),
    },
    requirements,
  };
};

const toMarkdown = (contract: ContractArtifact): string => {
  const lines: string[] = [];

  lines.push('# DOM compatibility contract');
  lines.push('');
  lines.push(`- Generated: ${contract.metadata.generatedAt}`);
  lines.push(`- Engine version: \`${contract.metadata.engineVersion}\``);
  lines.push(`- XPath source mode: \`${contract.metadata.xpathMode}\``);
  lines.push(`- Static requirements: ${contract.metadata.staticRequirements}`);
  lines.push(`- Dynamic requirements: ${contract.metadata.dynamicRequirements}`);
  lines.push(`- Dynamic status: \`${contract.metadata.dynamicStatus}\``);
  if (contract.metadata.dynamicError != null) {
    lines.push(`- Dynamic error: ${contract.metadata.dynamicError}`);
  }
  lines.push('');

  const interfaces = new Map<string, ContractRequirement[]>();
  for (const requirement of contract.requirements) {
    const current = interfaces.get(requirement.interface);
    if (current != null) {
      current.push(requirement);
      continue;
    }
    interfaces.set(requirement.interface, [requirement]);
  }

  for (const [interfaceName, requirements] of Array.from(interfaces.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`## ${interfaceName}`);
    lines.push('');
    for (const requirement of requirements.sort((a, b) => a.member.localeCompare(b.member))) {
      const staticFlag = requirement.staticReferenced ? 'yes' : 'no';
      const dynamicFlag = requirement.dynamicObserved ? 'yes' : 'no';
      const usageKinds = requirement.usageKinds.join(', ');
      const categories = requirement.categories.join(', ');
      lines.push(
        `- \`${requirement.member}\` (static: ${staticFlag}, dynamic: ${dynamicFlag}, usage: ${usageKinds}, categories: ${categories})`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const framePathFromStackLine = (line: string): string | null => {
  const parenMatch = line.match(/\((.*):\d+:\d+\)$/);
  if (parenMatch?.[1] != null) {
    return parenMatch[1];
  }

  const plainMatch = line.match(/at (.*):\d+:\d+$/);
  if (plainMatch?.[1] != null) {
    return plainMatch[1];
  }

  return null;
};

const classifyDynamicOnlyRequirement = (requirement: ContractRequirement): DynamicOnlyAttribution => {
  const environmentMarkers = [
    '/node_modules/jsdom/',
    '/node_modules/nwsapi/',
    '/node_modules/cssstyle/',
    '/node_modules/@asamuzakjp/dom-selector/',
    '/src/dynamicTrace.ts',
  ];

  const evidenceFrames: string[] = [];
  let classification: 'A' | 'B' | 'C' = 'C';
  let rationale =
    'Observed in the jsdom/instrumentation execution environment, with no direct ODK runtime frame.';

  for (const stack of requirement.dynamicSampleStacks) {
    for (const line of stack.split('\n')) {
      const trimmed = line.trim();
      const framePath = framePathFromStackLine(trimmed);
      if (framePath == null) {
        continue;
      }

      evidenceFrames.push(trimmed);

      if (framePath.includes('/node_modules/@getodk/xforms-engine/')) {
        classification = 'A';
        rationale = 'Frame resolves inside @getodk/xforms-engine runtime code.';
        return {
          interface: requirement.interface,
          member: requirement.member,
          classification,
          rationale,
          evidenceFrames: Array.from(new Set(evidenceFrames)).slice(0, 6),
          dynamicCount: requirement.dynamicCount,
        };
      }

      if (framePath.includes('/node_modules/@getodk/xpath/')) {
        classification = 'A';
        rationale = 'Frame resolves inside @getodk/xpath runtime code.';
        return {
          interface: requirement.interface,
          member: requirement.member,
          classification,
          rationale,
          evidenceFrames: Array.from(new Set(evidenceFrames)).slice(0, 6),
          dynamicCount: requirement.dynamicCount,
        };
      }

      if (environmentMarkers.some((marker) => framePath.includes(marker))) {
        classification = 'C';
        rationale = 'Frame resolves inside jsdom/selector/instrumentation internals.';
        continue;
      }

      if (framePath.includes('/node_modules/')) {
        classification = 'B';
        rationale = 'Frame resolves inside a transitive runtime dependency invoked by ODK runtime.';
      }
    }
  }

  return {
    interface: requirement.interface,
    member: requirement.member,
    classification,
    rationale,
    evidenceFrames: Array.from(new Set(evidenceFrames)).slice(0, 6),
    dynamicCount: requirement.dynamicCount,
  };
};

const canonicalInterfaceFromObservation = (
  interfaceName: string,
  memberName: string,
  memberInterfaces: ReadonlySet<string>
): string => {
  const hasNode = memberInterfaces.has('Node');
  const nodeFamily = new Set([
    'Node',
    'Element',
    'HTMLElement',
    'Document',
    'XMLDocument',
    'ChildNode',
    'ParentNode',
    'CharacterData',
    'Text',
    'Attr',
  ]);

  if (hasNode && nodeFamily.has(interfaceName)) {
    return 'Node';
  }

  if ((interfaceName === 'XMLDocument' || interfaceName === 'Document') && memberInterfaces.has('Document')) {
    return 'Document';
  }

  if ((interfaceName === 'HTMLElement' || interfaceName === 'Element') && memberInterfaces.has('Element')) {
    return 'Element';
  }

  if (interfaceName === 'XMLDocument') {
    return 'Document';
  }

  if (interfaceName === 'HTMLElement') {
    return 'Element';
  }

  return interfaceName;
};

const normalizeRequirements = (
  requirements: ContractRequirement[],
  dynamicAttribution: DynamicOnlyAttribution[]
): NormalizedRequirement[] => {
  const byMember = new Map<string, Set<string>>();
  for (const requirement of requirements) {
    const current = byMember.get(requirement.member);
    if (current != null) {
      current.add(requirement.interface);
      continue;
    }
    byMember.set(requirement.member, new Set([requirement.interface]));
  }

  const attributionByKey = new Map<string, DynamicOnlyAttribution>();
  for (const attribution of dynamicAttribution) {
    attributionByKey.set(getRequirementKey(attribution.interface, attribution.member), attribution);
  }

  const normalizedMap = new Map<string, NormalizedRequirement>();

  for (const requirement of requirements) {
    const memberInterfaces = byMember.get(requirement.member) ?? new Set<string>();
    const canonicalInterface = canonicalInterfaceFromObservation(
      requirement.interface,
      requirement.member,
      memberInterfaces
    );
    const normalizedKey = getRequirementKey(canonicalInterface, requirement.member);
    const attribution = attributionByKey.get(getRequirementKey(requirement.interface, requirement.member));
    const attributionSet = attribution == null ? [] : [attribution.classification];

    const existing = normalizedMap.get(normalizedKey);
    if (existing != null) {
      existing.staticReferenced = existing.staticReferenced || requirement.staticReferenced;
      existing.dynamicObserved = existing.dynamicObserved || requirement.dynamicObserved;
      existing.dynamicCount += requirement.dynamicCount;
      existing.interfacesObserved = Array.from(new Set([...existing.interfacesObserved, requirement.interface])).sort(
        (a, b) => a.localeCompare(b)
      );
      existing.categories = Array.from(new Set([...existing.categories, ...requirement.categories])).sort((a, b) =>
        a.localeCompare(b)
      );
      existing.usageKinds = Array.from(new Set([...existing.usageKinds, ...requirement.usageKinds])).sort((a, b) =>
        a.localeCompare(b)
      ) as UsageKind[];
      existing.sourcePackages = Array.from(new Set([...existing.sourcePackages, ...requirement.sourcePackages])).sort(
        (a, b) => a.localeCompare(b)
      );
      existing.sources = Array.from(new Set([...existing.sources, ...requirement.sources])).sort((a, b) =>
        a.localeCompare(b)
      );
      existing.dynamicSampleStacks = Array.from(
        new Set([...existing.dynamicSampleStacks, ...requirement.dynamicSampleStacks])
      );
      existing.dynamicAttribution = Array.from(new Set([...existing.dynamicAttribution, ...attributionSet])).sort();
      continue;
    }

    normalizedMap.set(normalizedKey, {
      interface: canonicalInterface,
      member: requirement.member,
      interfacesObserved: [requirement.interface],
      categories: requirement.categories,
      usageKinds: requirement.usageKinds,
      staticReferenced: requirement.staticReferenced,
      dynamicObserved: requirement.dynamicObserved,
      dynamicCount: requirement.dynamicCount,
      sourcePackages: requirement.sourcePackages,
      sources: requirement.sources,
      dynamicSampleStacks: requirement.dynamicSampleStacks,
      dynamicAttribution: attributionSet,
    });
  }

  return Array.from(normalizedMap.values()).sort((a, b) => {
    const interfaceOrder = a.interface.localeCompare(b.interface);
    if (interfaceOrder !== 0) {
      return interfaceOrder;
    }
    return a.member.localeCompare(b.member);
  });
};

const toPortableRequirements = (normalizedRequirements: NormalizedRequirement[]): NormalizedRequirement[] => {
  return normalizedRequirements.filter((requirement) => {
    if (requirement.staticReferenced) {
      return true;
    }

    if (!requirement.dynamicObserved) {
      return false;
    }

    return requirement.dynamicAttribution.some((classification) => classification === 'A' || classification === 'B');
  });
};

const severityForRequirement = (requirement: NormalizedRequirement): 'critical' | 'important' | 'easy-shim' => {
  const selectorMembers = new Set(['matches', 'querySelector', 'querySelectorAll']);
  const serializationMembers = new Set(['serializeToString', 'outerHTML', 'textContent']);
  const criticalMembers = new Set([
    'parseFromString',
    'createElementNS',
    'setAttributeNS',
    'getAttributeNS',
    'lookupNamespaceURI',
    'lookupPrefix',
    'nodeType',
    'nodeName',
    'ownerDocument',
    'documentElement',
    'append',
    'appendChild',
    'remove',
    'replaceWith',
    'cloneNode',
    'setAttribute',
    'getAttribute',
    'attributes',
  ]);

  if (requirement.categories.includes('xpath') || requirement.categories.includes('namespace')) {
    return 'critical';
  }

  if (criticalMembers.has(requirement.member) || requirement.categories.includes('mutation')) {
    return 'critical';
  }

  if (
    requirement.categories.includes('serialization') ||
    requirement.categories.includes('selector') ||
    selectorMembers.has(requirement.member) ||
    serializationMembers.has(requirement.member)
  ) {
    return 'important';
  }

  return 'easy-shim';
};

const getMemberValue = (target: unknown, memberName: string): unknown => {
  if (target == null || (typeof target !== 'object' && typeof target !== 'function')) {
    return undefined;
  }
  return (target as Record<string, unknown>)[memberName];
};

const PROBED_CALL_MEMBERS = new Set([
  'parseFromString',
  'serializeToString',
  'querySelector',
  'querySelectorAll',
  'matches',
  'createElementNS',
  'lookupNamespaceURI',
  'lookupPrefix',
]);

const probeCallableSupport = (
  context: CandidateContext,
  interfaceName: string,
  memberName: string,
  fn: (...args: unknown[]) => unknown,
  thisArg: unknown
): boolean => {
  const sampleDocument = context.instances.Document as Document | undefined;
  const sampleElement = context.instances.Element as Element | undefined;

  try {
    switch (memberName) {
      case 'parseFromString':
        fn.call(thisArg, '<root xmlns="urn:test"><child/></root>', 'text/xml');
        return true;
      case 'serializeToString':
        fn.call(thisArg, sampleDocument ?? sampleElement ?? thisArg);
        return true;
      case 'querySelector':
        fn.call(thisArg, '*');
        return true;
      case 'querySelectorAll':
        fn.call(thisArg, '*');
        return true;
      case 'matches':
        fn.call(thisArg, '*');
        return true;
      case 'createElementNS':
        fn.call(thisArg, 'urn:test', 'p:test');
        return true;
      case 'lookupNamespaceURI':
        fn.call(thisArg, null);
        return true;
      case 'lookupPrefix':
        fn.call(thisArg, 'urn:test');
        return true;
      default:
        return true;
    }
  } catch {
    return false;
  }
};

const supportsRequirement = (
  requirement: Pick<NormalizedRequirement, 'interface' | 'member' | 'usageKinds'>,
  context: CandidateContext
): boolean => {
  const interfaceName = requirement.interface;
  const memberName = requirement.member;
  const ctor = context.constructors[interfaceName];
  const instance = context.instances[interfaceName];

  if (memberName === '<constructor>' || memberName === '<instanceof>') {
    return typeof ctor === 'function';
  }

  const targets: unknown[] = [instance, ctor?.prototype, ctor];
  const requiresCallable = requirement.usageKinds.includes('call');

  for (const target of targets) {
    if (target == null || (typeof target !== 'object' && typeof target !== 'function')) {
      continue;
    }

    if (!(memberName in (target as object))) {
      continue;
    }

    if (!requiresCallable) {
      return true;
    }

    const memberValue = getMemberValue(target, memberName);
    if (typeof memberValue === 'function') {
      if (PROBED_CALL_MEMBERS.has(memberName)) {
        return probeCallableSupport(
          context,
          interfaceName,
          memberName,
          memberValue as (...args: unknown[]) => unknown,
          target
        );
      }
      return true;
    }
  }

  return false;
};

const buildJsdomContext = (): CandidateContext => {
  const dom = new JSDOM('<root xmlns="urn:test"><child id="x">v</child></root>', {
    contentType: 'text/xml',
  });

  const win = dom.window as unknown as Window & typeof globalThis;
  if (win.DOMParser == null || win.XMLSerializer == null) {
    throw new Error('jsdom window is missing DOMParser/XMLSerializer');
  }

  const parser = new win.DOMParser();
  const document = parser.parseFromString('<root xmlns="urn:test"><child id="x">v</child></root>', 'text/xml');
  const htmlDom = new JSDOM('<!doctype html><html><body><div id="m1"></div></body></html>', {
    contentType: 'text/html',
  });
  const htmlElement = htmlDom.window.document.getElementById('m1');
  const element = document.documentElement;
  const child = element.firstElementChild ?? element;
  const text = document.createTextNode('v');
  const processingInstruction =
    typeof document.createProcessingInstruction === 'function'
      ? document.createProcessingInstruction('m1', 'x')
      : null;
  const xpathResult =
    typeof document.evaluate === 'function' && typeof win.XPathResult === 'function'
      ? document.evaluate('//*', document, null, win.XPathResult.ANY_TYPE, null)
      : null;

  return {
    constructors: {
      Node: win.Node as unknown as Function | undefined,
      Document: win.Document as unknown as Function | undefined,
      Element: win.Element as unknown as Function | undefined,
      Attr: win.Attr as unknown as Function | undefined,
      NodeList: win.NodeList as unknown as Function | undefined,
      NamedNodeMap: win.NamedNodeMap as unknown as Function | undefined,
      DOMParser: win.DOMParser as unknown as Function | undefined,
      XMLSerializer: win.XMLSerializer as unknown as Function | undefined,
      XPathEvaluator: win.XPathEvaluator as unknown as Function | undefined,
      XPathResult: win.XPathResult as unknown as Function | undefined,
    },
    instances: {
      Node: text,
      Document: document,
      Element: child,
      Attr: child.getAttributeNode('id') ?? document.createAttribute('id'),
      NodeList: document.getElementsByTagName('*'),
      NamedNodeMap: child.attributes,
      ParentNode: element,
      ChildNode: child,
      CharacterData: text,
      Text: text,
      ProcessingInstruction: processingInstruction ?? text,
      XMLDocument: document,
      HTMLElement: htmlElement ?? element,
      DOMParser: parser,
      XMLSerializer: new win.XMLSerializer(),
      XPathResult: xpathResult,
    },
  };
};

const buildXmlDomContext = (): CandidateContext => {
  const parser = new XmlDomParser();
  const document = parser.parseFromString('<root xmlns="urn:test"><child id="x">v</child></root>', 'text/xml');
  const child = document.documentElement.firstChild ?? document.documentElement;
  const element = document.documentElement;
  const text = document.createTextNode('v');
  const processingInstruction =
    typeof document.createProcessingInstruction === 'function'
      ? document.createProcessingInstruction('m1', 'x')
      : null;

  return {
    constructors: {
      DOMParser: XmlDomParser as unknown as Function,
      XMLSerializer: XmlDomSerializer as unknown as Function,
      Document: document.constructor as Function,
      Element: element.constructor as Function,
      Node: text.constructor as Function,
      Attr: (document.documentElement.getAttributeNode('id') ?? document.createAttribute('id'))
        .constructor as Function,
      NodeList: document.getElementsByTagName('*').constructor as Function,
      NamedNodeMap: document.documentElement.attributes.constructor as Function,
      XMLDocument: document.constructor as Function,
    },
    instances: {
      DOMParser: parser,
      XMLSerializer: new XmlDomSerializer(),
      Document: document,
      Element: element,
      Node: text,
      Attr: document.documentElement.getAttributeNode('id') ?? document.createAttribute('id'),
      NodeList: document.getElementsByTagName('*'),
      NamedNodeMap: document.documentElement.attributes,
      ParentNode: element,
      ChildNode: child,
      CharacterData: text,
      Text: text,
      ProcessingInstruction: processingInstruction ?? text,
      XMLDocument: document,
    },
  };
};

const buildLinkedomContext = (): CandidateContext => {
  const parser = new LinkeDomParser();
  const parsed = parser.parseFromString('<root xmlns="urn:test"><child id="x">v</child></root>', 'text/xml') as {
    document?: Document;
  };
  const parsedHtml = parseLinkedomHTML('<!doctype html><html><body><div id="m1"></div></body></html>');
  const document = parsed.document ?? (parsed as unknown as Document);
  if (document.documentElement == null) {
    throw new Error('linkedom did not produce a documentElement');
  }
  const htmlElement = parsedHtml.document.getElementById('m1');
  const element = document.documentElement;
  const child = element.firstElementChild ?? element;
  const text = document.createTextNode('v');
  const processingInstruction =
    typeof document.createProcessingInstruction === 'function'
      ? document.createProcessingInstruction('m1', 'x')
      : null;

  return {
    constructors: {
      DOMParser: LinkeDomParser as unknown as Function,
      Document: document.constructor as Function,
      Element: element.constructor as Function,
      Node: text.constructor as Function,
      Attr: (child.getAttributeNode('id') ?? document.createAttribute('id')).constructor as Function,
      NodeList: document.getElementsByTagName('*').constructor as Function,
      NamedNodeMap: child.attributes.constructor as Function,
      XMLDocument: document.constructor as Function,
    },
    instances: {
      DOMParser: parser,
      Document: document,
      Element: element,
      Node: text,
      Attr: child.getAttributeNode('id') ?? document.createAttribute('id'),
      NodeList: document.getElementsByTagName('*'),
      NamedNodeMap: child.attributes,
      ParentNode: element,
      ChildNode: child,
      CharacterData: text,
      Text: text,
      ProcessingInstruction: processingInstruction ?? text,
      XMLDocument: document,
      HTMLElement: htmlElement ?? element,
    },
  };
};

const buildSlimdomContext = (): CandidateContext => {
  const parser = new SlimDomParser();
  const document = parser.parseFromString('<root xmlns="urn:test"><child id="x">v</child></root>', 'text/xml');
  if (document.documentElement == null) {
    throw new Error('slimdom did not produce a documentElement');
  }

  const element = document.documentElement;
  const child = element.firstElementChild ?? element;
  const text = document.createTextNode('v');
  const processingInstruction =
    typeof document.createProcessingInstruction === 'function'
      ? document.createProcessingInstruction('m1', 'x')
      : null;

  return {
    constructors: {
      DOMParser: SlimDomParser as unknown as Function,
      XMLSerializer: SlimDomSerializer as unknown as Function,
      Document: document.constructor as Function,
      Element: element.constructor as Function,
      Node: text.constructor as Function,
      Attr: (child.getAttributeNode('id') ?? document.createAttribute('id')).constructor as Function,
      NodeList: document.getElementsByTagName('*').constructor as Function,
      NamedNodeMap: child.attributes.constructor as Function,
      XMLDocument: document.constructor as Function,
    },
    instances: {
      DOMParser: parser,
      XMLSerializer: new SlimDomSerializer(),
      Document: document,
      Element: element,
      Node: text,
      Attr: child.getAttributeNode('id') ?? document.createAttribute('id'),
      NodeList: document.getElementsByTagName('*'),
      NamedNodeMap: child.attributes,
      ParentNode: element,
      ChildNode: child,
      CharacterData: text,
      Text: text,
      ProcessingInstruction: processingInstruction ?? text,
      XMLDocument: document,
      HTMLElement: element,
    },
  };
};

const buildOozcitakContext = (): CandidateContext => {
  const parser = new OozDomParser();
  const document = parser.parseFromString('<root xmlns="urn:test"><child id="x">v</child></root>', 'text/xml');
  if (document.documentElement == null) {
    throw new Error('@oozcitak/dom did not produce a documentElement');
  }

  const element = document.documentElement;
  const child = element.firstElementChild ?? element;
  const text = document.createTextNode('v');
  const processingInstruction =
    typeof document.createProcessingInstruction === 'function'
      ? document.createProcessingInstruction('m1', 'x')
      : null;

  return {
    constructors: {
      DOMParser: OozDomParser as unknown as Function,
      XMLSerializer: OozXmlSerializer as unknown as Function,
      Document: document.constructor as Function,
      Element: element.constructor as Function,
      Node: text.constructor as Function,
      Attr: (child.getAttributeNode('id') ?? document.createAttribute('id')).constructor as Function,
      NodeList: document.getElementsByTagName('*').constructor as Function,
      NamedNodeMap: child.attributes.constructor as Function,
      XMLDocument: document.constructor as Function,
    },
    instances: {
      DOMParser: parser,
      XMLSerializer: new OozXmlSerializer(),
      Document: document,
      Element: element,
      Node: text,
      Attr: child.getAttributeNode('id') ?? document.createAttribute('id'),
      NodeList: document.getElementsByTagName('*'),
      NamedNodeMap: child.attributes,
      ParentNode: element,
      ChildNode: child,
      CharacterData: text,
      Text: text,
      ProcessingInstruction: processingInstruction ?? text,
      XMLDocument: document,
      HTMLElement: element,
    },
  };
};

const requirementLabel = (requirement: Pick<NormalizedRequirement, 'interface' | 'member'>): string =>
  `${requirement.interface}.${requirement.member}`;

const evaluateCoverage = (
  requirements: NormalizedRequirement[],
  context: CandidateContext
): {
  supported: number;
  total: number;
  coverage: number;
  unsupported: string[];
  unsupportedRequirements: NormalizedRequirement[];
} => {
  const unsupportedRequirements: NormalizedRequirement[] = [];
  let supported = 0;

  for (const requirement of requirements) {
    if (supportsRequirement(requirement, context)) {
      supported += 1;
      continue;
    }
    unsupportedRequirements.push(requirement);
  }

  const total = requirements.length;
  return {
    supported,
    total,
    coverage: total === 0 ? 0 : supported / total,
    unsupported: unsupportedRequirements.map((requirement) => requirementLabel(requirement)),
    unsupportedRequirements,
  };
};

const evaluateCandidate = (
  name: string,
  context: CandidateContext,
  observedRequirements: NormalizedRequirement[],
  portableRequirements: NormalizedRequirement[]
): CandidateCoverage => {
  const rawCoverage = evaluateCoverage(observedRequirements, context);
  const portableCoverage = evaluateCoverage(portableRequirements, context);

  const severity = {
    critical: [] as string[],
    important: [] as string[],
    easyShim: [] as string[],
  };

  for (const requirement of portableCoverage.unsupportedRequirements) {
    const bucket = severityForRequirement(requirement);
    const label = requirementLabel(requirement);
    if (bucket === 'critical') {
      severity.critical.push(label);
    } else if (bucket === 'important') {
      severity.important.push(label);
    } else {
      severity.easyShim.push(label);
    }
  }

  return {
    name,
    raw: {
      supported: rawCoverage.supported,
      total: rawCoverage.total,
      coverage: rawCoverage.coverage,
      unsupported: rawCoverage.unsupported,
    },
    portable: {
      supported: portableCoverage.supported,
      total: portableCoverage.total,
      coverage: portableCoverage.coverage,
      unsupported: portableCoverage.unsupported,
      severity,
    },
  };
};

const candidatesMarkdown = (coverages: CandidateCoverage[]): string => {
  const lines: string[] = [];
  lines.push('# Candidate DOM library coverage');
  lines.push('');
  lines.push('| Candidate | Raw coverage | Portable coverage | Critical gaps | Important gaps | Easy-shim gaps |');
  lines.push('|---|---:|---:|---:|---:|---:|');

  for (const coverage of coverages) {
    lines.push(
      `| ${coverage.name} | ${(coverage.raw.coverage * 100).toFixed(1)}% (${coverage.raw.supported}/${coverage.raw.total}) | ${(coverage.portable.coverage * 100).toFixed(1)}% (${coverage.portable.supported}/${coverage.portable.total}) | ${coverage.portable.severity.critical.length} | ${coverage.portable.severity.important.length} | ${coverage.portable.severity.easyShim.length} |`
    );
  }

  lines.push('');
  for (const coverage of coverages) {
    lines.push(`## ${coverage.name}`);
    lines.push('');
    lines.push(
      `- Raw coverage: ${(coverage.raw.coverage * 100).toFixed(1)}% (${coverage.raw.supported}/${coverage.raw.total})`
    );
    lines.push(
      `- Portable coverage: ${(coverage.portable.coverage * 100).toFixed(1)}% (${coverage.portable.supported}/${coverage.portable.total})`
    );
    lines.push(`- Critical gaps: ${coverage.portable.severity.critical.length}`);
    lines.push(`- Important gaps: ${coverage.portable.severity.important.length}`);
    lines.push(`- Easy-shim gaps: ${coverage.portable.severity.easyShim.length}`);

    const sections: Array<[string, string[]]> = [
      ['Critical', coverage.portable.severity.critical],
      ['Important', coverage.portable.severity.important],
      ['Easy-shim', coverage.portable.severity.easyShim],
    ];

    for (const [label, items] of sections) {
      if (items.length === 0) {
        continue;
      }

      lines.push(`- ${label} missing:`);
      for (const item of items.slice(0, 30)) {
        lines.push(`  - \`${item}\``);
      }
      if (items.length > 30) {
        lines.push(`  - ... ${items.length - 30} more`);
      }
    }

    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const toObservedMarkdown = (artifact: ObservedContractArtifact): string => {
  const lines: string[] = [];
  lines.push('# Observed reference contract (M1)');
  lines.push('');
  lines.push(`- Generated: ${artifact.metadata.generatedAt}`);
  lines.push(`- Engine version: \`${artifact.metadata.engineVersion}\``);
  lines.push(`- XPath source mode: \`${artifact.metadata.xpathMode}\``);
  lines.push(`- Raw observed requirements: ${artifact.requirements.length}`);
  lines.push(`- Normalized requirements: ${artifact.normalizedRequirements.length}`);
  lines.push(`- Dynamic status: \`${artifact.metadata.dynamicStatus}\``);
  lines.push('');

  const groupedAttribution = {
    A: artifact.dynamicOnlyAttribution.filter((row) => row.classification === 'A'),
    B: artifact.dynamicOnlyAttribution.filter((row) => row.classification === 'B'),
    C: artifact.dynamicOnlyAttribution.filter((row) => row.classification === 'C'),
  };

  lines.push('## Dynamic-only attribution (M1.2)');
  lines.push('');
  lines.push(`- A (Direct ODK): ${groupedAttribution.A.length}`);
  lines.push(`- B (Transitive dependency): ${groupedAttribution.B.length}`);
  lines.push(`- C (Reference environment/internal): ${groupedAttribution.C.length}`);
  lines.push('');

  for (const row of artifact.dynamicOnlyAttribution.sort((a, b) =>
    `${a.interface}.${a.member}`.localeCompare(`${b.interface}.${b.member}`)
  )) {
    lines.push(`- \`${row.interface}.${row.member}\` → **${row.classification}** (${row.rationale})`);
    if (row.evidenceFrames.length > 0) {
      lines.push(`  - evidence: \`${row.evidenceFrames[0]}\``);
    }
  }
  lines.push('');

  lines.push('## Normalized requirements (M1.1)');
  lines.push('');
  const byInterface = new Map<string, NormalizedRequirement[]>();
  for (const requirement of artifact.normalizedRequirements) {
    const current = byInterface.get(requirement.interface);
    if (current != null) {
      current.push(requirement);
      continue;
    }
    byInterface.set(requirement.interface, [requirement]);
  }

  for (const [interfaceName, requirements] of Array.from(byInterface.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`### ${interfaceName}`);
    for (const requirement of requirements.sort((a, b) => a.member.localeCompare(b.member))) {
      const attribution = requirement.dynamicAttribution.length > 0 ? requirement.dynamicAttribution.join(',') : '-';
      lines.push(
        `- \`${requirement.member}\` (observed via: ${requirement.interfacesObserved.join(', ')}, static: ${requirement.staticReferenced ? 'yes' : 'no'}, dynamic: ${requirement.dynamicObserved ? 'yes' : 'no'}, attribution: ${attribution})`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const toPortableMarkdown = (artifact: PortableContractArtifact): string => {
  const lines: string[] = [];
  lines.push('# Portable required contract (M1)');
  lines.push('');
  lines.push(`- Generated: ${artifact.metadata.generatedAt}`);
  lines.push(`- Based on observed contract generated at: ${artifact.metadata.basedOn}`);
  lines.push(`- Normalized observed requirements: ${artifact.metadata.normalizedRequirements}`);
  lines.push(`- Portable requirements: ${artifact.metadata.portableRequirements}`);
  lines.push('');

  const severityCounts = {
    critical: 0,
    important: 0,
    easyShim: 0,
  };

  for (const requirement of artifact.requirements) {
    const severity = severityForRequirement(requirement);
    if (severity === 'critical') {
      severityCounts.critical += 1;
    } else if (severity === 'important') {
      severityCounts.important += 1;
    } else {
      severityCounts.easyShim += 1;
    }
  }

  lines.push(`- Critical requirements: ${severityCounts.critical}`);
  lines.push(`- Important requirements: ${severityCounts.important}`);
  lines.push(`- Easy-shim requirements: ${severityCounts.easyShim}`);
  lines.push('');

  const byInterface = new Map<string, NormalizedRequirement[]>();
  for (const requirement of artifact.requirements) {
    const current = byInterface.get(requirement.interface);
    if (current != null) {
      current.push(requirement);
      continue;
    }
    byInterface.set(requirement.interface, [requirement]);
  }

  for (const [interfaceName, requirements] of Array.from(byInterface.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`## ${interfaceName}`);
    lines.push('');
    for (const requirement of requirements.sort((a, b) => a.member.localeCompare(b.member))) {
      const severity = severityForRequirement(requirement);
      lines.push(
        `- \`${requirement.member}\` (severity: ${severity}, evidence: ${requirement.staticReferenced ? 'static' : `dynamic-${requirement.dynamicAttribution.join('|')}`})`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const main = (): void => {
  const staticArtifact = readJson<StaticArtifact>(staticPath);
  const dynamicArtifact = fs.existsSync(dynamicPath) ? readJson<DynamicArtifact>(dynamicPath) : undefined;

  const contract = mergeArtifacts(staticArtifact, dynamicArtifact);
  const dynamicOnlyAttribution = contract.requirements
    .filter((requirement) => !requirement.staticReferenced && requirement.dynamicObserved)
    .map(classifyDynamicOnlyRequirement);
  const normalizedRequirements = normalizeRequirements(contract.requirements, dynamicOnlyAttribution);
  const portableRequirements = toPortableRequirements(normalizedRequirements);

  const observedArtifact: ObservedContractArtifact = {
    ...contract,
    normalizedRequirements,
    dynamicOnlyAttribution,
  };

  const portableArtifact: PortableContractArtifact = {
    metadata: {
      generatedAt: new Date().toISOString(),
      basedOn: contract.metadata.generatedAt,
      staticRequirements: contract.metadata.staticRequirements,
      dynamicRequirements: contract.metadata.dynamicRequirements,
      normalizedRequirements: normalizedRequirements.length,
      portableRequirements: portableRequirements.length,
    },
    requirements: portableRequirements,
  };

  writeJson(contractPath, contract);
  writeJson(observedContractPath, observedArtifact);
  writeJson(portableContractPath, portableArtifact);
  fs.writeFileSync(summaryPath, toMarkdown(contract), 'utf8');
  fs.writeFileSync(observedSummaryPath, toObservedMarkdown(observedArtifact), 'utf8');
  fs.writeFileSync(portableSummaryPath, toPortableMarkdown(portableArtifact), 'utf8');

  const coverages = [
    evaluateCandidate('jsdom (reference)', buildJsdomContext(), normalizedRequirements, portableRequirements),
    evaluateCandidate('@oozcitak/dom', buildOozcitakContext(), normalizedRequirements, portableRequirements),
    evaluateCandidate('slimdom', buildSlimdomContext(), normalizedRequirements, portableRequirements),
    evaluateCandidate('linkedom', buildLinkedomContext(), normalizedRequirements, portableRequirements),
    evaluateCandidate('@xmldom/xmldom', buildXmlDomContext(), normalizedRequirements, portableRequirements),
  ].sort((a, b) => {
    const criticalDiff = a.portable.severity.critical.length - b.portable.severity.critical.length;
    if (criticalDiff !== 0) {
      return criticalDiff;
    }

    const importantDiff = a.portable.severity.important.length - b.portable.severity.important.length;
    if (importantDiff !== 0) {
      return importantDiff;
    }

    const portableCoverageDiff = b.portable.coverage - a.portable.coverage;
    if (portableCoverageDiff !== 0) {
      return portableCoverageDiff;
    }

    return b.raw.coverage - a.raw.coverage;
  });

  fs.writeFileSync(candidatesPath, candidatesMarkdown(coverages), 'utf8');

  console.log(
    `Merged contract written with ${contract.requirements.length} raw requirements, ${normalizedRequirements.length} normalized, ${portableRequirements.length} portable`
  );
};

main();
