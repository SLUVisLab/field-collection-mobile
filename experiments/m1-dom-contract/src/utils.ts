import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const experimentRoot = path.resolve(scriptDir, '..');
export const outDir = path.join(experimentRoot, 'out');
export const vendorDir = path.join(experimentRoot, 'vendor');

export const ensureDir = (dirPath: string): void => {
  fs.mkdirSync(dirPath, { recursive: true });
};

export const writeJson = (filePath: string, value: unknown): void => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

export const readJson = <T>(filePath: string): T => {
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text) as T;
};

export const toPosixPath = (value: string): string => value.replaceAll(path.sep, '/');

export const relativeToExperiment = (absolutePath: string): string => {
  return toPosixPath(path.relative(experimentRoot, absolutePath));
};

export const walkFiles = (root: string, includeExtensions: ReadonlySet<string>): string[] => {
  if (!fs.existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }

    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      const children = fs.readdirSync(current);
      for (const child of children) {
        stack.push(path.join(current, child));
      }
      continue;
    }

    const extension = path.extname(current);
    if (includeExtensions.has(extension)) {
      files.push(current);
    }
  }

  files.sort((a, b) => a.localeCompare(b));
  return files;
};

const namespaceMembers = new Set<string>([
  'createElementNS',
  'getAttributeNS',
  'setAttributeNS',
  'lookupNamespaceURI',
  'lookupPrefix',
  'namespaceURI',
  'localName',
  'prefix',
]);

const serializationMembers = new Set<string>([
  'serializeToString',
  'textContent',
  'innerHTML',
  'outerHTML',
]);

const mutationMembers = new Set<string>([
  'appendChild',
  'removeChild',
  'replaceChild',
  'insertBefore',
  'cloneNode',
  'setAttribute',
  'removeAttribute',
  'replaceChildren',
  'before',
  'after',
]);

const selectorMembers = new Set<string>(['querySelector', 'querySelectorAll', 'matches', 'closest']);
const constantsMembers = new Set<string>([
  'nodeType',
  'nodeName',
  'DOCUMENT_NODE',
  'ELEMENT_NODE',
  'TEXT_NODE',
  'ATTRIBUTE_NODE',
  'DOCUMENT_FRAGMENT_NODE',
]);
const xpathMembers = new Set<string>(['evaluate', 'createNSResolver']);

export const classifyCategories = (interfaceName: string, memberName: string): string[] => {
  const categories = new Set<string>();

  if (namespaceMembers.has(memberName)) {
    categories.add('namespace');
  }
  if (serializationMembers.has(memberName) || interfaceName === 'XMLSerializer') {
    categories.add('serialization');
  }
  if (mutationMembers.has(memberName)) {
    categories.add('mutation');
  }
  if (selectorMembers.has(memberName)) {
    categories.add('selector');
  }
  if (constantsMembers.has(memberName)) {
    categories.add('constants');
  }
  if (xpathMembers.has(memberName) || interfaceName.startsWith('XPath')) {
    categories.add('xpath');
  }
  if (memberName === '<constructor>' || memberName === '<instanceof>') {
    categories.add('global-constructor');
  }

  if (categories.size === 0) {
    categories.add('other');
  }

  return Array.from(categories).sort((a, b) => a.localeCompare(b));
};

