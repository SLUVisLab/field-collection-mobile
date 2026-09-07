#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const slimdom = require('slimdom');
const { installSlimdomSelectorAdapter } = require('./selectorAdapter');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(__dirname, 'out');
const selectorFixturePath = path.join(__dirname, 'fixtures', 'selector-fixture.xml');

const scopedSelectors = [
  ':scope > hint',
  ':scope > item',
  ':scope > itemset[nodeset]',
  ':scope > label',
  ':scope > label[form-definition-source="repeat-group"]',
  ':scope > repeat[nodeset]',
  ':scope > value',
  ':scope > submission',
];

const unscopedSelectors = [
  'itemset[ref], repeat[ref], *[nodeset]:not(itemset, repeat)',
  'repeat',
  'itemset[nodeset]',
];

const matchesSelectors = [
  { targetId: 'hint-node', selector: 'hint' },
  { targetId: 'itemset-nodeset-node', selector: 'itemset[nodeset]' },
  {
    targetId: 'repeat-group-label-node',
    selector: 'label[form-definition-source="repeat-group"]',
  },
  { targetId: 'repeat-nodeset-node', selector: 'repeat[nodeset]' },
  { targetId: 'submission-node', selector: 'submission' },
];

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const loadJSDOM = () => {
  try {
    return require('jsdom');
  } catch {
    const fallbackPath = path.join(
      repoRoot,
      'experiments',
      'm1-dom-contract',
      'node_modules',
      'jsdom'
    );
    return require(fallbackPath);
  }
};

const elementChildren = (node) => {
  if (node?.children != null) {
    return Array.from(node.children);
  }
  if (node?.childNodes != null) {
    return Array.from(node.childNodes).filter((child) => child.nodeType === 1);
  }
  return [];
};

const findById = (root, idValue) => {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null || current.nodeType !== 1) {
      continue;
    }
    if (current.getAttribute('id') === idValue) {
      return current;
    }
    const children = elementChildren(current);
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push(children[i]);
    }
  }
  return null;
};

const findFirstByLocalName = (root, localName) => {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null || current.nodeType !== 1) {
      continue;
    }
    if (current.localName === localName) {
      return current;
    }
    const children = elementChildren(current);
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push(children[i]);
    }
  }
  return null;
};

const nodeDescriptor = (node) => {
  if (node == null) {
    return null;
  }
  const parts = [];
  let current = node;

  while (current != null && current.nodeType === 1) {
    const siblings = current.parentElement
      ? elementChildren(current.parentElement).filter((sibling) => sibling.nodeName === current.nodeName)
      : [current];
    const index = siblings.indexOf(current) + 1;
    parts.push(`${current.nodeName}[${index}]`);
    current = current.parentElement;
  }

  return {
    path: parts.reverse().join('/'),
    localName: node.localName,
    nodeName: node.nodeName,
    namespaceURI: node.namespaceURI,
    prefix: node.prefix,
    id: node.getAttribute ? node.getAttribute('id') : null,
  };
};

const collectSelectorResults = (document) => {
  const body = findFirstByLocalName(document.documentElement, 'body');
  if (body == null) {
    throw new Error('Fixture did not parse with an h:body element');
  }
  const group = findFirstByLocalName(body, 'group');
  if (group == null) {
    throw new Error('Fixture did not parse with a group element');
  }

  const scoped = scopedSelectors.map((selector) => ({
    selector,
    querySelector: nodeDescriptor(group.querySelector(selector)),
    querySelectorAll: Array.from(group.querySelectorAll(selector)).map(nodeDescriptor),
  }));

  const unscoped = unscopedSelectors.map((selector) => ({
    selector,
    querySelector: nodeDescriptor(body.querySelector(selector)),
    querySelectorAll: Array.from(body.querySelectorAll(selector)).map(nodeDescriptor),
  }));

  const matches = matchesSelectors.map(({ targetId, selector }) => {
    const target = findById(document.documentElement, targetId);
    if (target == null) {
      throw new Error(`Expected fixture target with id="${targetId}"`);
    }
    return {
      targetId,
      target: nodeDescriptor(target),
      selector,
      matches: target.matches(selector),
    };
  });

  return { scoped, unscoped, matches };
};

const runJsdomReference = (fixtureXml) => {
  const { JSDOM } = loadJSDOM();
  const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
  const parser = new jsdom.window.DOMParser();
  const document = parser.parseFromString(fixtureXml, 'text/xml');
  const result = collectSelectorResults(document);
  jsdom.window.close();
  return result;
};

const runSlimdomCandidate = (fixtureXml) => {
  const restoreSelectorAdapter = installSlimdomSelectorAdapter({
    ElementClass: slimdom.Element,
    DocumentClass: slimdom.Document,
  });
  try {
    const parser = new slimdom.DOMParser();
    const document = parser.parseFromString(fixtureXml, 'text/xml');
    return collectSelectorResults(document);
  } finally {
    restoreSelectorAdapter();
  }
};

const compareResults = (reference, candidate) => {
  const differences = [];

  const compareValue = (label, left, right) => {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      differences.push({ label, reference: left, candidate: right });
    }
  };

  compareValue('scoped selectors', reference.scoped, candidate.scoped);
  compareValue('unscoped selectors', reference.unscoped, candidate.unscoped);
  compareValue('matches selectors', reference.matches, candidate.matches);

  return {
    equivalent: differences.length === 0,
    differences,
  };
};

const writeMarkdown = (report) => {
  const lines = [];
  lines.push('# M2.1 selector semantic comparison');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Equivalent to jsdom for tested selectors: **${report.comparison.equivalent ? 'yes' : 'no'}**`);
  lines.push('');

  lines.push('## Tested selectors');
  lines.push('');
  lines.push(`- Scoped selectors: ${scopedSelectors.map((selector) => `\`${selector}\``).join(', ')}`);
  lines.push(`- Unscoped selectors: ${unscopedSelectors.map((selector) => `\`${selector}\``).join(', ')}`);
  lines.push(`- matches selectors: ${matchesSelectors.map((item) => `\`${item.selector}\``).join(', ')}`);
  lines.push('');

  lines.push('## Candidate outcome');
  lines.push('');
  lines.push(`- Scoped selector checks: ${report.candidate.scoped.length}`);
  lines.push(`- Unscoped selector checks: ${report.candidate.unscoped.length}`);
  lines.push(`- matches checks: ${report.candidate.matches.length}`);
  lines.push('');

  if (!report.comparison.equivalent) {
    lines.push('## Differences');
    lines.push('');
    for (const difference of report.comparison.differences) {
      lines.push(`- ${difference.label}`);
      lines.push(`  - jsdom: \`${JSON.stringify(difference.reference)}\``);
      lines.push(`  - slimdom+adapter: \`${JSON.stringify(difference.candidate)}\``);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const main = () => {
  ensureDir(outDir);
  const fixtureXml = fs.readFileSync(selectorFixturePath, 'utf8');

  const reference = runJsdomReference(fixtureXml);
  const candidate = runSlimdomCandidate(fixtureXml);
  const comparison = compareResults(reference, candidate);

  const report = {
    generatedAt: new Date().toISOString(),
    reference,
    candidate,
    comparison,
  };

  const jsonPath = path.join(outDir, 'm2.1-selector-semantic-comparison.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const mdPath = path.join(outDir, 'm2.1-selector-semantic-comparison.md');
  fs.writeFileSync(mdPath, writeMarkdown(report), 'utf8');

  if (!comparison.equivalent) {
    console.error(`Selector comparison failed; see ${path.relative(repoRoot, mdPath)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Selector comparison passed; see ${path.relative(repoRoot, mdPath)}`);
};

main();
