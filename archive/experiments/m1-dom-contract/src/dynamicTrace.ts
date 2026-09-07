import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import type { DynamicArtifact, DynamicRequirement, UsageKind } from './types.js';
import { outDir, relativeToExperiment, writeJson } from './utils.js';

type AnyRecord = Record<string, unknown>;

interface TraceCounter {
  usageKinds: Set<UsageKind>;
  count: number;
  sampleStacks: Set<string>;
}

const require = createRequire(import.meta.url);
const engineEntryPath = require.resolve('@getodk/xforms-engine');
const engineRoot = path.resolve(path.dirname(engineEntryPath), '..');
const enginePackagePath = path.join(engineRoot, 'package.json');
const engineManifest = JSON.parse(fs.readFileSync(enginePackagePath, 'utf8')) as { version: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturePath = path.resolve(__dirname, '..', 'fixtures', 'minimal-xform.xml');
const outPath = path.join(outDir, 'dynamic-dom-usage.json');

const trace = new Map<string, TraceCounter>();

const traceKey = (interfaceName: string, memberName: string): string => `${interfaceName}::${memberName}`;

const MAX_SAMPLE_STACKS = 5;

const captureSampleStack = (): string | null => {
  const stack = new Error().stack;
  if (stack == null) {
    return null;
  }

  const frames = stack
    .split('\n')
    .slice(2)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.includes('/src/dynamicTrace.ts'))
    .filter((line) => !line.includes('wrappedMethod'))
    .filter((line) => !line.includes('wrappedGetter'))
    .filter((line) => !line.includes('wrappedSetter'));

  if (frames.length === 0) {
    return null;
  }

  return frames.slice(0, 8).join('\n');
};

const record = (interfaceName: string, memberName: string, usageKind: UsageKind): void => {
  const key = traceKey(interfaceName, memberName);
  const sampleStack = captureSampleStack();
  const current = trace.get(key);
  if (current != null) {
    current.count += 1;
    current.usageKinds.add(usageKind);
    if (sampleStack != null && current.sampleStacks.size < MAX_SAMPLE_STACKS) {
      current.sampleStacks.add(sampleStack);
    }
    return;
  }

  trace.set(key, {
    usageKinds: new Set([usageKind]),
    count: 1,
    sampleStacks: sampleStack == null ? new Set<string>() : new Set([sampleStack]),
  });
};

const wrapConstructor = <T extends new (...args: any[]) => any>(
  interfaceName: string,
  ctor: T
): T => {
  const wrapped = new Proxy(ctor, {
    construct(target, argArray, newTarget) {
      record(interfaceName, '<constructor>', 'new');
      return Reflect.construct(target, argArray, newTarget);
    },
  });

  return wrapped as T;
};

const wrapPrototype = (interfaceName: string, prototypeObject: object): void => {
  const propertyNames = Object.getOwnPropertyNames(prototypeObject);

  for (const propertyName of propertyNames) {
    if (propertyName === 'constructor') {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(prototypeObject, propertyName);
    if (descriptor == null || descriptor.configurable !== true) {
      continue;
    }

    if (typeof descriptor.value === 'function') {
      const original = descriptor.value;
      Object.defineProperty(prototypeObject, propertyName, {
        ...descriptor,
        value: function wrappedMethod(this: unknown, ...args: unknown[]) {
          record(interfaceName, propertyName, 'call');
          return Reflect.apply(original, this, args);
        },
      });
      continue;
    }

    const wrappedDescriptor: PropertyDescriptor = { ...descriptor };

    if (descriptor.get != null) {
      const originalGet = descriptor.get;
      wrappedDescriptor.get = function wrappedGetter(this: unknown) {
        record(interfaceName, propertyName, 'get');
        return Reflect.apply(originalGet, this, []);
      };
    }

    if (descriptor.set != null) {
      const originalSet = descriptor.set;
      wrappedDescriptor.set = function wrappedSetter(this: unknown, value: unknown) {
        record(interfaceName, propertyName, 'set');
        return Reflect.apply(originalSet, this, [value]);
      };
    }

    Object.defineProperty(prototypeObject, propertyName, wrappedDescriptor);
  }
};

const installJsDomGlobals = (): void => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    contentType: 'text/html',
  });

  const win = dom.window as unknown as AnyRecord;
  const g = globalThis as unknown as AnyRecord;

  const constructorNames = [
    'Node',
    'Document',
    'Element',
    'Attr',
    'NodeList',
    'NamedNodeMap',
    'DocumentFragment',
    'CharacterData',
    'Text',
    'Comment',
    'ProcessingInstruction',
    'DOMParser',
    'XMLSerializer',
  ];

  for (const constructorName of constructorNames) {
    const value = win[constructorName];
    if (typeof value !== 'function') {
      continue;
    }

    const wrappedCtor = wrapConstructor(constructorName, value as new (...args: unknown[]) => unknown);
    g[constructorName] = wrappedCtor;
    const prototype = (wrappedCtor as unknown as { prototype: object }).prototype;
    wrapPrototype(constructorName, prototype);
  }

  g.window = win;
  g.document = win.document;

  if (g.navigator == null && win.navigator != null) {
    g.navigator = win.navigator;
  }
};

const withBrowserLikeProcess = async <T>(work: () => Promise<T>): Promise<T> => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');

  Object.defineProperty(globalThis, 'process', {
    value: undefined,
    configurable: true,
    writable: true,
  });

  try {
    return await work();
  } finally {
    if (descriptor == null) {
      Reflect.deleteProperty(globalThis, 'process');
    } else {
      Object.defineProperty(globalThis, 'process', descriptor);
    }
  }
};

const getChildren = (node: unknown): unknown[] => {
  if (typeof node !== 'object' || node == null) {
    return [];
  }

  const state = (node as AnyRecord).currentState as AnyRecord | undefined;
  const children = state?.children;
  return Array.isArray(children) ? children : [];
};

const maybeSetInputValue = (node: unknown): void => {
  if (typeof node !== 'object' || node == null) {
    return;
  }

  const nodeRecord = node as AnyRecord;
  if (nodeRecord.nodeType !== 'input' || typeof nodeRecord.setValue !== 'function') {
    return;
  }

  const state = nodeRecord.currentState as AnyRecord | undefined;
  const reference = state?.reference;
  if (typeof reference !== 'string') {
    return;
  }

  if (reference.endsWith('/name')) {
    Reflect.apply(nodeRecord.setValue as (...args: unknown[]) => unknown, node, ['Ada']);
    return;
  }

  if (reference.endsWith('/age')) {
    Reflect.apply(nodeRecord.setValue as (...args: unknown[]) => unknown, node, [17]);
  }
};

const traverseNodes = (rootNode: unknown): void => {
  const stack: unknown[] = [rootNode];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }

    maybeSetInputValue(current);

    const children = getChildren(current);
    for (const child of children) {
      stack.push(child);
    }
  }
};

const toDynamicRequirements = (): DynamicRequirement[] => {
  const requirements: DynamicRequirement[] = [];
  for (const [key, value] of trace.entries()) {
    const [interfaceName, memberName] = key.split('::');
    requirements.push({
      interface: interfaceName,
      member: memberName,
      usageKinds: Array.from(value.usageKinds).sort((a, b) => a.localeCompare(b)) as UsageKind[],
      count: value.count,
      sampleStacks: Array.from(value.sampleStacks),
    });
  }

  requirements.sort((a, b) => {
    const interfaceOrder = a.interface.localeCompare(b.interface);
    if (interfaceOrder !== 0) {
      return interfaceOrder;
    }
    return a.member.localeCompare(b.member);
  });

  return requirements;
};

const runProbe = async (): Promise<void> => {
  installJsDomGlobals();

  const xformXml = fs.readFileSync(fixturePath, 'utf8');
  await withBrowserLikeProcess(async () => {
    const engine = (await import('@getodk/xforms-engine')) as {
      loadForm: (resource: string) => Promise<{
        status: 'success' | 'warning' | 'failure';
        error: Error | null;
        createInstance: () => { root: unknown };
      }>;
    };

    const formResult = await engine.loadForm(xformXml);
    if (formResult.status === 'failure') {
      throw formResult.error ?? new Error('loadForm returned failure with no error object');
    }

    const instance = formResult.createInstance();
    traverseNodes(instance.root);

    const root = instance.root as {
      prepareInstancePayload?: () => Promise<{ data: readonly FormData[] }>;
    };

    if (typeof root.prepareInstancePayload !== 'function') {
      throw new Error('Form instance root does not expose prepareInstancePayload');
    }

    const payload = await root.prepareInstancePayload();
    const [firstData] = payload.data;
    const instanceFile = firstData.get('xml_submission_file');

    if (instanceFile == null || typeof (instanceFile as File).text !== 'function') {
      throw new Error('Could not access xml_submission_file from prepared payload');
    }

    await (instanceFile as File).text();
  });
};

const buildArtifact = (status: 'ok' | 'error', error?: Error): DynamicArtifact => {
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      engineVersion: engineManifest.version,
      fixturePath: relativeToExperiment(fixturePath),
      status,
      ...(error == null
        ? {}
        : {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }),
    },
    requirements: toDynamicRequirements(),
  };
};

const main = async (): Promise<void> => {
  try {
    await runProbe();
    const artifact = buildArtifact('ok');
    writeJson(outPath, artifact);
    console.log(`Dynamic trace complete: ${artifact.requirements.length} observed requirements`);
  } catch (error) {
    const resolvedError =
      error instanceof Error ? error : new Error(`Unexpected dynamic trace failure: ${String(error)}`);
    const artifact = buildArtifact('error', resolvedError);
    writeJson(outPath, artifact);
    console.error(`Dynamic trace failed: ${resolvedError.message}`);
  }
};

await main();
