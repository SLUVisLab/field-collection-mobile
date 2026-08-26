import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DOMParser, XMLSerializer } from '@oozcitak/dom';
import { outDir, relativeToExperiment, writeJson } from './utils.js';

type AnyRecord = Record<string, unknown>;

interface SmokeResult {
  generatedAt: string;
  candidate: '@oozcitak/dom';
  engineVersion: string;
  fixturePath: string;
  status: 'ok' | 'error';
  loadStatus?: 'success' | 'warning' | 'failure';
  payloadBytes?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(__dirname, '..', 'fixtures', 'minimal-xform.xml');
const outputPath = path.join(outDir, 'm2-oozcitak-smoke.json');

const require = createRequire(import.meta.url);
const engineEntryPath = require.resolve('@getodk/xforms-engine');
const engineRoot = path.resolve(path.dirname(engineEntryPath), '..');
const engineManifestPath = path.join(engineRoot, 'package.json');
const engineManifest = JSON.parse(fs.readFileSync(engineManifestPath, 'utf8')) as { version: string };

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

const installOozcitakGlobals = (): void => {
  const parser = new DOMParser();
  const seed = parser.parseFromString('<root><child id="x">v</child></root>', 'text/xml');
  if (seed.documentElement == null) {
    throw new Error('@oozcitak/dom parser did not produce a root element');
  }

  const element = seed.documentElement;
  const child = element.firstElementChild ?? element;
  const text = seed.createTextNode('v');
  const attr = child.getAttributeNode('id') ?? seed.createAttribute('id');
  const nodeList = seed.getElementsByTagName('*');

  const g = globalThis as unknown as AnyRecord;
  g.DOMParser = DOMParser;
  g.XMLSerializer = XMLSerializer;
  g.document = seed;
  g.window = { document: { currentScript: null } };

  g.Document = seed.constructor;
  g.Element = element.constructor;
  g.Node = text.constructor;
  g.Text = text.constructor;
  g.CharacterData = text.constructor;
  g.Attr = attr.constructor;
  g.NodeList = nodeList.constructor;
  g.NamedNodeMap = child.attributes.constructor;

  if (typeof seed.createDocumentFragment === 'function') {
    const fragment = seed.createDocumentFragment();
    g.DocumentFragment = fragment.constructor;
  }

  if (typeof seed.createProcessingInstruction === 'function') {
    const pi = seed.createProcessingInstruction('m2', 'x');
    g.ProcessingInstruction = pi.constructor;
  }
};

const getChildren = (node: unknown): unknown[] => {
  if (typeof node !== 'object' || node == null) {
    return [];
  }

  const currentState = (node as AnyRecord).currentState as AnyRecord | undefined;
  const children = currentState?.children;
  return Array.isArray(children) ? children : [];
};

const maybeSetInputValue = (node: unknown): void => {
  if (typeof node !== 'object' || node == null) {
    return;
  }

  const record = node as AnyRecord;
  if (record.nodeType !== 'input' || typeof record.setValue !== 'function') {
    return;
  }

  const reference = ((record.currentState as AnyRecord | undefined)?.reference ?? null) as string | null;
  if (reference == null) {
    return;
  }

  if (reference.endsWith('/name')) {
    Reflect.apply(record.setValue as (...args: unknown[]) => unknown, node, ['Ada']);
  }

  if (reference.endsWith('/age')) {
    Reflect.apply(record.setValue as (...args: unknown[]) => unknown, node, [17]);
  }
};

const traverseAndSetValues = (rootNode: unknown): void => {
  const stack: unknown[] = [rootNode];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }

    maybeSetInputValue(current);
    for (const child of getChildren(current)) {
      stack.push(child);
    }
  }
};

const runSmoke = async (): Promise<SmokeResult> => {
  installOozcitakGlobals();
  const xml = fs.readFileSync(fixturePath, 'utf8');

  return withBrowserLikeProcess(async () => {
    const engine = (await import('@getodk/xforms-engine')) as {
      loadForm: (resource: string) => Promise<{
        status: 'success' | 'warning' | 'failure';
        error: Error | null;
        createInstance: () => { root: unknown };
      }>;
    };

    const loaded = await engine.loadForm(xml);
    if (loaded.status === 'failure') {
      return {
        generatedAt: new Date().toISOString(),
        candidate: '@oozcitak/dom',
        engineVersion: engineManifest.version,
        fixturePath: relativeToExperiment(fixturePath),
        status: 'error',
        loadStatus: 'failure',
        error: {
          name: loaded.error?.name ?? 'LoadFormFailure',
          message: loaded.error?.message ?? 'loadForm returned failure',
          stack: loaded.error?.stack,
        },
      };
    }

    const instance = loaded.createInstance();
    traverseAndSetValues(instance.root);

    const root = instance.root as {
      prepareInstancePayload?: () => Promise<{ data: readonly FormData[] }>;
    };

    if (typeof root.prepareInstancePayload !== 'function') {
      throw new Error('Form instance root is missing prepareInstancePayload');
    }

    const payload = await root.prepareInstancePayload();
    const [firstData] = payload.data;
    const instanceFile = firstData.get('xml_submission_file');
    if (instanceFile == null || typeof (instanceFile as File).text !== 'function') {
      throw new Error('Missing xml_submission_file in payload');
    }

    const instanceXml = await (instanceFile as File).text();

    return {
      generatedAt: new Date().toISOString(),
      candidate: '@oozcitak/dom',
      engineVersion: engineManifest.version,
      fixturePath: relativeToExperiment(fixturePath),
      status: 'ok',
      loadStatus: loaded.status,
      payloadBytes: Buffer.byteLength(instanceXml, 'utf8'),
    };
  });
};

const main = async (): Promise<void> => {
  try {
    const result = await runSmoke();
    writeJson(outputPath, result);
    if (result.status === 'ok') {
      console.log(
        `@oozcitak/dom smoke test succeeded (loadStatus=${result.loadStatus}, payloadBytes=${result.payloadBytes})`
      );
      return;
    }

    console.error(`@oozcitak/dom smoke test failed: ${result.error?.message ?? 'unknown error'}`);
  } catch (error) {
    const resolvedError = error instanceof Error ? error : new Error(String(error));
    const result: SmokeResult = {
      generatedAt: new Date().toISOString(),
      candidate: '@oozcitak/dom',
      engineVersion: engineManifest.version,
      fixturePath: relativeToExperiment(fixturePath),
      status: 'error',
      error: {
        name: resolvedError.name,
        message: resolvedError.message,
        stack: resolvedError.stack,
      },
    };
    writeJson(outputPath, result);
    console.error(`@oozcitak/dom smoke test failed: ${resolvedError.message}`);
  }
};

await main();

