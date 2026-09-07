#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(__dirname, 'out');

const inventoryTargets = [
  {
    classification: 'A',
    sourceType: 'runtime',
    file: 'node_modules/@getodk/xforms-engine/src/parse/XFormDOM.ts',
  },
  {
    classification: 'A',
    sourceType: 'runtime',
    file: 'node_modules/@getodk/xforms-engine/src/lib/dom/query.ts',
  },
  {
    classification: 'A',
    sourceType: 'runtime-bundled',
    file: 'node_modules/@getodk/xforms-engine/dist/index.js',
  },
  {
    classification: 'C',
    sourceType: 'tests/reference-only',
    file: 'experiments/m1-dom-contract/vendor/xpath/test',
    isDirectory: true,
  },
];

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const readText = (relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
};

const lineNumberAt = (text, index) => {
  return text.slice(0, index).split('\n').length;
};

const capabilityFromSelector = (selector) => {
  const normalized = selector.trim();
  return {
    selector: normalized,
    features: {
      typeSelector: /(^|[\s>,(:])([A-Za-z_][A-Za-z0-9:_-]*)/.test(normalized),
      selectorList: normalized.includes(','),
      childCombinator: normalized.includes('>'),
      universalSelector: normalized.includes('*'),
      attributePresenceSelector: /\[[^\]=\s]+\]/.test(normalized),
      attributeValueSelector: /\[[^\]=\s]+\s*=/.test(normalized),
      scopePseudoClass: normalized.includes(':scope'),
      notPseudoClass: normalized.includes(':not('),
    },
  };
};

const extractFromText = (relativePath, text, classification, sourceType) => {
  const entries = [];

  const addEntries = (regex, methodName) => {
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match != null) {
      const [, quote, selectorText] = match;
      const selector = selectorText.replace(/\s+/g, ' ').trim();
      entries.push({
        classification,
        sourceType,
        method: methodName,
        file: relativePath,
        line: lineNumberAt(text, match.index),
        selectorType: 'static',
        selector,
      });
      match = regex.exec(text);
    }
  };

  addEntries(/\.querySelectorAll\(\s*(['"`])([\s\S]*?)\1\s*\)/g, 'querySelectorAll');
  addEntries(/\.querySelector\(\s*(['"`])([\s\S]*?)\1\s*\)/g, 'querySelector');
  addEntries(/\.matches\(\s*(['"`])([\s\S]*?)\1\s*\)/g, 'matches');

  const scopedLookupRegex =
    /new ScopedElementLookup\(\s*(['"`])([\s\S]*?)\1\s*,\s*(['"`])([\s\S]*?)\3\s*\)/g;
  scopedLookupRegex.lastIndex = 0;
  let scopedMatch = scopedLookupRegex.exec(text);
  while (scopedMatch != null) {
    entries.push({
      classification,
      sourceType,
      method: 'ScopedElementLookup',
      file: relativePath,
      line: lineNumberAt(text, scopedMatch.index),
      selectorType: 'static',
      selector: scopedMatch[2].replace(/\s+/g, ' ').trim(),
      fallbackSelector: scopedMatch[4].replace(/\s+/g, ' ').trim(),
    });
    scopedMatch = scopedLookupRegex.exec(text);
  }

  return entries;
};

const extractFromDirectory = (target) => {
  const directoryPath = path.join(repoRoot, target.file);
  if (!fs.existsSync(directoryPath)) {
    return [];
  }
  const rgResult = spawnSync(
    'rg',
    [
      '--no-heading',
      '--line-number',
      '--color',
      'never',
      '\\.querySelectorAll\\(|\\.querySelector\\(|\\.matches\\(',
      directoryPath,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  if (rgResult.status !== 0 && rgResult.stdout.trim().length === 0) {
    return [];
  }

  return rgResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const firstColon = line.indexOf(':');
      const secondColon = line.indexOf(':', firstColon + 1);
      const filePath = line.slice(0, firstColon);
      const lineNumber = Number(line.slice(firstColon + 1, secondColon));
      const content = line.slice(secondColon + 1).trim();
      const method = content.includes('.querySelectorAll(')
        ? 'querySelectorAll'
        : content.includes('.querySelector(')
          ? 'querySelector'
          : 'matches';
      return {
        classification: target.classification,
        sourceType: target.sourceType,
        method,
        file: path.relative(repoRoot, filePath),
        line: lineNumber,
        selectorType: 'dynamic-or-test',
        selector: '<test expression or dynamic value>',
      };
    });
};

const summarizeCapabilities = (selectorEntries) => {
  const selectorSet = new Map();
  for (const entry of selectorEntries) {
    if (entry.selector != null && !entry.selector.startsWith('<')) {
      selectorSet.set(entry.selector, capabilityFromSelector(entry.selector));
    }
    if (entry.fallbackSelector != null) {
      selectorSet.set(entry.fallbackSelector, capabilityFromSelector(entry.fallbackSelector));
    }
  }

  const capabilities = Array.from(selectorSet.values());
  const summary = {
    selectors: capabilities.map((item) => item.selector).sort(),
    featuresUsed: {
      typeSelector: capabilities.some((item) => item.features.typeSelector),
      selectorList: capabilities.some((item) => item.features.selectorList),
      childCombinator: capabilities.some((item) => item.features.childCombinator),
      universalSelector: capabilities.some((item) => item.features.universalSelector),
      attributePresenceSelector: capabilities.some((item) => item.features.attributePresenceSelector),
      attributeValueSelector: capabilities.some((item) => item.features.attributeValueSelector),
      scopePseudoClass: capabilities.some((item) => item.features.scopePseudoClass),
      notPseudoClass: capabilities.some((item) => item.features.notPseudoClass),
      namespaceSensitiveSelectorSyntax: capabilities.some((item) => /[:|]/.test(item.selector)),
      idSelector: capabilities.some((item) => /#[A-Za-z_]/.test(item.selector)),
      nthPseudoClass: capabilities.some((item) => /:nth-/.test(item.selector)),
    },
  };

  return summary;
};

const writeMarkdown = (report) => {
  const lines = [];
  lines.push('# M2.1 Selector usage inventory');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Runtime selector call sites (A): ${report.counts.A}`);
  lines.push(`- Transitive runtime selector call sites (B): ${report.counts.B}`);
  lines.push(`- Test/reference-only selector call sites (C): ${report.counts.C}`);
  lines.push('');
  lines.push('## Selector capability inventory (runtime A only)');
  lines.push('');
  lines.push(`- Selectors observed: ${report.capabilities.selectors.map((value) => `\`${value}\``).join(', ')}`);
  lines.push('- Features used:');
  for (const [feature, used] of Object.entries(report.capabilities.featuresUsed)) {
    lines.push(`  - ${feature}: ${used}`);
  }
  lines.push('');
  lines.push('## Runtime call sites (A)');
  lines.push('');
  lines.push('| Method | Selector | Fallback selector | File | Line |');
  lines.push('|---|---|---|---|---|');
  for (const entry of report.entries.filter((item) => item.classification === 'A')) {
    lines.push(
      `| ${entry.method} | ${entry.selector ?? ''} | ${entry.fallbackSelector ?? ''} | \`${entry.file}\` | ${entry.line} |`
    );
  }
  lines.push('');
  lines.push('## Reference/test call sites (C)');
  lines.push('');
  lines.push('These call sites are from xpath tests and are not required by production runtime behavior.');
  lines.push('');
  lines.push('| Method | File | Line |');
  lines.push('|---|---|---|');
  for (const entry of report.entries.filter((item) => item.classification === 'C').slice(0, 40)) {
    lines.push(`| ${entry.method} | \`${entry.file}\` | ${entry.line} |`);
  }
  if (report.entries.filter((item) => item.classification === 'C').length > 40) {
    lines.push('');
    lines.push(`- Additional C-classified test call sites omitted in table: ${report.entries.filter((item) => item.classification === 'C').length - 40}`);
  }
  lines.push('');
  lines.push('## Classification notes');
  lines.push('');
  lines.push('- **A**: direct selector requirements from published xforms-engine runtime code.');
  lines.push('- **B**: transitive runtime requirements from non-ODK dependencies (none observed in this inventory).');
  lines.push('- **C**: test/dev/reference-environment-only selector usage.');
  lines.push('');

  return `${lines.join('\n')}\n`;
};

const main = () => {
  ensureDir(outDir);

  const entries = [];
  for (const target of inventoryTargets) {
    if (target.isDirectory) {
      entries.push(...extractFromDirectory(target));
      continue;
    }
    const text = readText(target.file);
    entries.push(...extractFromText(target.file, text, target.classification, target.sourceType));
  }

  const runtimeEntries = entries.filter((entry) => entry.classification === 'A');
  const capabilities = summarizeCapabilities(runtimeEntries);

  const report = {
    generatedAt: new Date().toISOString(),
    entries,
    counts: {
      A: entries.filter((entry) => entry.classification === 'A').length,
      B: entries.filter((entry) => entry.classification === 'B').length,
      C: entries.filter((entry) => entry.classification === 'C').length,
    },
    capabilities,
  };

  const jsonPath = path.join(outDir, 'm2.1-selector-inventory.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const mdPath = path.join(outDir, 'm2.1-selector-inventory.md');
  fs.writeFileSync(mdPath, writeMarkdown(report), 'utf8');

  console.log(`Selector inventory written to ${path.relative(repoRoot, mdPath)}`);
};

main();
