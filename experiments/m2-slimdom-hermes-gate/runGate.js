#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runDomProbe, runSlimdomHermesGateProbe } = require('./probeLogic');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(__dirname, 'out');
const slimdomPackagePath = path.join(repoRoot, 'node_modules', 'slimdom', 'package.json');
const gatePrefix = 'M2_SLIMDOM_HERMES_GATE::';
const hermesBin = path.join(repoRoot, 'node_modules', 'react-native', 'sdks', 'hermesc', 'osx-bin', 'hermes');

const matrix = [
  { platform: 'android', mode: 'debug', dev: true, minify: false },
  { platform: 'ios', mode: 'debug', dev: true, minify: false },
  { platform: 'android', mode: 'release', dev: false, minify: true },
  { platform: 'ios', mode: 'release', dev: false, minify: true },
];

const run = (command, args, cwd = repoRoot) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 50 * 1024 * 1024,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

const trimOutput = (text, max = 8000) => {
  if (text.length <= max) {
    return text;
  }
  const remaining = text.length - max;
  return `${text.slice(0, max)}\n...[truncated ${remaining} chars]`;
};

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const parseGatePayload = (combinedOutput) => {
  const lines = combinedOutput.split('\n');
  for (const line of lines) {
    const index = line.indexOf(gatePrefix);
    if (index === -1) {
      continue;
    }
    const payloadText = line.slice(index + gatePrefix.length).trim();
    try {
      return JSON.parse(payloadText);
    } catch {
      return null;
    }
  }
  return null;
};

const walkFiles = (rootDir) => {
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null || !fs.existsSync(current)) {
      continue;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  return files;
};

const scanForPortabilitySignals = (packageDir, runtimeDependencyNames) => {
  const nodesToScan = [packageDir];
  for (const dependencyName of runtimeDependencyNames) {
    const dependencyDir = path.join(repoRoot, 'node_modules', dependencyName);
    if (fs.existsSync(dependencyDir)) {
      nodesToScan.push(dependencyDir);
    }
  }

  const patterns = {
    nodeCoreImports: /(?:from\s+['"]|require\(\s*['"])(?:fs|path|url|buffer|process|stream|crypto|node:[^'"]+)(?:['"]\s*\)?)/g,
    browserGlobals: /\b(window|document|navigator|self)\b/g,
    processOrBufferUse: /\b(process|Buffer)\b/g,
  };

  const findings = {
    nodeCoreImports: [],
    browserGlobals: [],
    processOrBufferUse: [],
    wasmFiles: [],
    nativeAddonFiles: [],
  };

  for (const nodePath of nodesToScan) {
    const files = walkFiles(nodePath);
    for (const filePath of files) {
      const relativePath = path.relative(repoRoot, filePath);
      if (filePath.endsWith('.wasm')) {
        findings.wasmFiles.push(relativePath);
        continue;
      }
      if (filePath.endsWith('.node')) {
        findings.nativeAddonFiles.push(relativePath);
        continue;
      }
      if (!/\.(js|mjs|cjs|ts)$/.test(filePath)) {
        continue;
      }
      const text = fs.readFileSync(filePath, 'utf8');
      for (const [key, regex] of Object.entries(patterns)) {
        regex.lastIndex = 0;
        if (regex.test(text)) {
          findings[key].push(relativePath);
        }
      }
    }
  }

  for (const key of Object.keys(findings)) {
    findings[key] = [...new Set(findings[key])].sort();
  }
  return findings;
};

const portabilityInspection = () => {
  const packageJson = JSON.parse(fs.readFileSync(slimdomPackagePath, 'utf8'));
  const runtimeDependencies = Object.keys(packageJson.dependencies ?? {});
  const packageDir = path.dirname(slimdomPackagePath);
  const portabilitySignals = scanForPortabilitySignals(packageDir, runtimeDependencies);

  return {
    package: {
      name: packageJson.name,
      version: packageJson.version,
      type: packageJson.type ?? null,
      main: packageJson.main ?? null,
      module: packageJson.module ?? null,
      exports: packageJson.exports ?? null,
      browser: packageJson.browser ?? null,
      reactNative: packageJson['react-native'] ?? null,
      engines: packageJson.engines ?? null,
    },
    runtimeDependencyCount: runtimeDependencies.length,
    runtimeDependencies,
    declaredJsTarget: packageJson.engines?.node ?? null,
    signals: portabilitySignals,
  };
};

const getJSDomConstructors = () => {
  let JSDOM = null;
  try {
    ({ JSDOM } = require('jsdom'));
  } catch {
    const m1JsdomPath = path.join(
      repoRoot,
      'experiments',
      'm1-dom-contract',
      'node_modules',
      'jsdom'
    );
    ({ JSDOM } = require(m1JsdomPath));
  }
  const jsdom = new JSDOM('<!doctype html><html></html>');
  return {
    DOMParser: jsdom.window.DOMParser,
    XMLSerializer: jsdom.window.XMLSerializer,
  };
};

const compareAgainstJsdom = (slimdomResult) => {
  const jsdomResult = runDomProbe(getJSDomConstructors(), 'jsdom-reference');
  const differences = [];

  const compareField = (fieldPath, slimdomValue, jsdomValue) => {
    if (slimdomValue !== jsdomValue) {
      differences.push({
        field: fieldPath,
        slimdom: slimdomValue,
        jsdom: jsdomValue,
      });
    }
  };

  const sObs = slimdomResult.observations ?? {};
  const jObs = jsdomResult.observations ?? {};

  compareField(
    'parsing.rootLocalName',
    sObs.parsing?.rootLocalName ?? null,
    jObs.parsing?.rootLocalName ?? null
  );
  compareField(
    'parsing.rootNamespaceURI',
    sObs.parsing?.rootNamespaceURI ?? null,
    jObs.parsing?.rootNamespaceURI ?? null
  );
  compareField(
    'namespaces.lookupNamespaceUriH',
    sObs.namespaces?.lookupNamespaceUriH ?? null,
    jObs.namespaces?.lookupNamespaceUriH ?? null
  );
  compareField(
    'namespaces.attribute.namespaceURI',
    sObs.namespaces?.attribute?.namespaceURI ?? null,
    jObs.namespaces?.attribute?.namespaceURI ?? null
  );
  compareField(
    'namespaces.getAttributeNsValue',
    sObs.namespaces?.getAttributeNsValue ?? null,
    jObs.namespaces?.getAttributeNsValue ?? null
  );
  compareField(
    'serialization.roundTripRootNamespaceURI',
    sObs.serialization?.roundTripRootNamespaceURI ?? null,
    jObs.serialization?.roundTripRootNamespaceURI ?? null
  );
  compareField(
    'serialization.roundTripLookupNamespaceUriH',
    sObs.serialization?.roundTripLookupNamespaceUriH ?? null,
    jObs.serialization?.roundTripLookupNamespaceUriH ?? null
  );
  compareField(
    'serialization.roundTripTextContentIncludesPlant',
    sObs.serialization?.roundTripTextContentIncludesPlant ?? null,
    jObs.serialization?.roundTripTextContentIncludesPlant ?? null
  );

  return {
    slimdom: slimdomResult,
    jsdom: jsdomResult,
    equivalentForCheckedFields: differences.length === 0,
    differences,
  };
};

const runMatrixEntry = (entry) => {
  const baseName = `${entry.platform}-${entry.mode}`;
  const bundlePath = path.join(outDir, `${baseName}.bundle.js`);
  const assetsDir = path.join(outDir, 'assets', baseName);

  ensureDir(path.dirname(bundlePath));
  ensureDir(assetsDir);

  const bundleArgs = [
    'react-native',
    'bundle',
    '--entry-file',
    'experiments/m2-slimdom-hermes-gate/metroEntry.js',
    '--platform',
    entry.platform,
    '--dev',
    String(entry.dev),
    '--minify',
    String(entry.minify),
    '--bundle-output',
    path.relative(repoRoot, bundlePath),
    '--assets-dest',
    path.relative(repoRoot, assetsDir),
    '--reset-cache',
  ];

  const bundleResult = run('npx', bundleArgs);
  if (bundleResult.status !== 0) {
    return {
      ...entry,
      metroResolution: 'fail',
      bundle: {
        ok: false,
        status: bundleResult.status,
        stdout: trimOutput(bundleResult.stdout),
        stderr: trimOutput(bundleResult.stderr),
      },
      hermes: {
        ok: false,
        skipped: true,
      },
    };
  }

  const hermesResult = run(hermesBin, [bundlePath]);
  const combinedOutput = `${hermesResult.stdout}\n${hermesResult.stderr}`;
  const gatePayload = parseGatePayload(combinedOutput);

  return {
    ...entry,
    metroResolution: 'ok',
    bundle: {
      ok: true,
      status: 0,
      outputPath: path.relative(repoRoot, bundlePath),
      stdout: trimOutput(bundleResult.stdout),
      stderr: trimOutput(bundleResult.stderr),
    },
    hermes: {
      ok: hermesResult.status === 0,
      status: hermesResult.status,
      gatePayload,
      stdout: trimOutput(hermesResult.stdout),
      stderr: trimOutput(hermesResult.stderr),
    },
  };
};

const summarizeResults = (matrixResults, portability, comparison) => {
  const packageJson = require(path.join(repoRoot, 'package.json'));
  const yarnVersion = run('yarn', ['-v']).stdout.trim();
  const hermesVersion = run(hermesBin, ['-version']).stdout.trim() || run(hermesBin, ['-version']).stderr.trim();

  const releasePasses = matrixResults.filter(
    (result) => result.mode === 'release' && result.bundle.ok && result.hermes.ok
  );
  const metroFailures = matrixResults.filter((result) => !result.bundle.ok);
  const hermesFailures = matrixResults.filter((result) => result.bundle.ok && !result.hermes.ok);
  const payloadFailures = matrixResults.filter(
    (result) => result.hermes.gatePayload != null && result.hermes.gatePayload.ok === false
  );

  const hasCriticalPortabilityBlocker =
    portability.signals.nodeCoreImports.length > 0 ||
    portability.signals.wasmFiles.length > 0 ||
    portability.signals.nativeAddonFiles.length > 0;

  let verdict = 'GREEN';
  const reasons = [];

  if (metroFailures.length > 0 || hermesFailures.length > 0 || payloadFailures.length > 0) {
    verdict = 'RED';
  }
  if (releasePasses.length === 0) {
    verdict = 'RED';
    reasons.push('No release Hermes matrix entry passed.');
  }
  if (hasCriticalPortabilityBlocker) {
    verdict = 'RED';
  }

  if (metroFailures.length > 0) {
    reasons.push('Metro bundling failed for one or more matrix targets.');
  }
  if (hermesFailures.length > 0) {
    reasons.push('Hermes execution failed for one or more bundled targets.');
  }
  if (payloadFailures.length > 0) {
    reasons.push('Probe logic failed for one or more Hermes runs.');
  }
  if (portability.signals.nodeCoreImports.length > 0) {
    reasons.push('Runtime imports Node core modules.');
  }
  if (portability.signals.wasmFiles.length > 0) {
    reasons.push('Runtime includes WASM artifacts.');
  }
  if (portability.signals.nativeAddonFiles.length > 0) {
    reasons.push('Runtime includes native addon artifacts.');
  }
  if (!comparison.equivalentForCheckedFields) {
    reasons.push('Slimdom differs from jsdom on one or more checked XML semantics.');
  }

  let recommendation = 'Proceed to M2.1 selector-adapter evaluation using slimdom.';
  if (verdict === 'YELLOW') {
    recommendation = 'Proceed cautiously with the documented isolated workaround.';
  }
  if (verdict === 'RED') {
    recommendation = 'Reject slimdom for M2 and reassess fallback candidates.';
  }

  return {
    generatedAt: new Date().toISOString(),
    versions: {
      node: process.version,
      yarn: yarnVersion,
      reactNative: packageJson.dependencies['react-native'],
      expo: packageJson.dependencies.expo,
      hermes: hermesVersion,
    },
    packageVersionTested: portability.package.version,
    portabilityInspection: portability,
    filesChanged: [
      'package.json',
      'yarn.lock',
      'experiments/m2-slimdom-hermes-gate/probeLogic.js',
      'experiments/m2-slimdom-hermes-gate/metroEntry.js',
      'experiments/m2-slimdom-hermes-gate/runGate.js',
      'experiments/m2-slimdom-hermes-gate/out/m2.0-hermes-gate-results.json',
      'experiments/m2-slimdom-hermes-gate/out/m2.0-hermes-gate-results.md',
      'experiments/m2-oozcitak-hermes-gate/out/decision-record.md',
    ],
    matrix: Object.fromEntries(matrixResults.map((result) => [`${result.platform}-${result.mode}`, result])),
    releasePassPlatforms: releasePasses.map((result) => result.platform),
    namespaceEquivalence: comparison,
    knownSelectorApiUnsupported: {
      elementMatches: comparison.slimdom.knownGapChecks?.elementMatches === false,
      elementQuerySelector: comparison.slimdom.knownGapChecks?.elementQuerySelector === false,
      elementQuerySelectorAll: comparison.slimdom.knownGapChecks?.elementQuerySelectorAll === false,
      documentCurrentScript: comparison.slimdom.knownGapChecks?.documentCurrentScript === false,
    },
    verdict,
    reasons,
    recommendation,
  };
};

const writeMarkdown = (summary) => {
  const lines = [];
  lines.push('# M2.0 `slimdom` Hermes gate');
  lines.push('');
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Verdict: **${summary.verdict}**`);
  lines.push(`- Recommendation: ${summary.recommendation}`);
  lines.push('');
  lines.push('## Deliverables');
  lines.push('');
  lines.push(`1. Exact slimdom version tested: \`${summary.packageVersionTested}\``);
  lines.push(
    `2. Gather versions: Node \`${summary.versions.node}\`, Yarn \`${summary.versions.yarn}\`, React Native \`${summary.versions.reactNative}\`, Expo \`${summary.versions.expo}\`, Hermes \`${summary.versions.hermes}\``
  );
  lines.push(`3. Package portability inspection: runtime deps=${summary.portabilityInspection.runtimeDependencyCount}`);
  lines.push(`4. Files added/changed: ${summary.filesChanged.map((value) => `\`${value}\``).join(', ')}`);
  lines.push('5. Debug results by platform: see matrix table.');
  lines.push('6. Release results by platform: see matrix table.');
  lines.push(`7. Namespace-equivalence result: ${summary.namespaceEquivalence.equivalentForCheckedFields ? 'equivalent for checked fields' : 'differences observed'}.`);
  lines.push('8. Serialization results: encoded in probe observations per matrix entry and jsdom comparison.');
  lines.push(
    `9. Known unsupported APIs confirmed: Element.matches=${summary.knownSelectorApiUnsupported.elementMatches}, Element.querySelector=${summary.knownSelectorApiUnsupported.elementQuerySelector}, Element.querySelectorAll=${summary.knownSelectorApiUnsupported.elementQuerySelectorAll}, Document.currentScript=${summary.knownSelectorApiUnsupported.documentCurrentScript}`
  );
  lines.push(`10. Conclusion: **${summary.verdict}**`);
  lines.push(`11. Recommendation: ${summary.recommendation}`);
  lines.push('');
  lines.push('## Portability inspection details');
  lines.push('');
  lines.push(`- Package type: \`${summary.portabilityInspection.package.type}\``);
  lines.push(`- main: \`${summary.portabilityInspection.package.main}\``);
  lines.push(`- module: \`${summary.portabilityInspection.package.module}\``);
  lines.push(`- exports field present: ${summary.portabilityInspection.package.exports != null}`);
  lines.push(`- browser field: ${summary.portabilityInspection.package.browser == null ? 'none' : '`present`'}`);
  lines.push(
    `- react-native field: ${summary.portabilityInspection.package.reactNative == null ? 'none' : '`present`'}`
  );
  lines.push(
    `- Node-core import hits: ${summary.portabilityInspection.signals.nodeCoreImports.length === 0 ? 'none' : summary.portabilityInspection.signals.nodeCoreImports.join(', ')}`
  );
  lines.push(
    `- Browser global hits: ${summary.portabilityInspection.signals.browserGlobals.length === 0 ? 'none' : summary.portabilityInspection.signals.browserGlobals.join(', ')}`
  );
  lines.push(
    `- process/Buffer hits: ${summary.portabilityInspection.signals.processOrBufferUse.length === 0 ? 'none' : summary.portabilityInspection.signals.processOrBufferUse.join(', ')}`
  );
  lines.push(`- WASM files: ${summary.portabilityInspection.signals.wasmFiles.length}`);
  lines.push(`- Native addon files: ${summary.portabilityInspection.signals.nativeAddonFiles.length}`);
  lines.push('');
  lines.push('## Hermes matrix');
  lines.push('');
  lines.push('- Execution method: Metro bundle for each target, then Hermes CLI evaluation of that target bundle.');
  lines.push('');
  lines.push('| Platform | Mode | Metro resolution | Bundle success | Hermes execution | XML parsing | Namespace checks | Mutation checks | Serialization |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const result of Object.values(summary.matrix)) {
    const payload = result.hermes.gatePayload;
    const parsing = payload?.observations?.parsing != null ? 'ok' : result.hermes.skipped ? 'not run' : 'fail';
    const namespaces =
      payload?.observations?.namespaces != null ? 'ok' : result.hermes.skipped ? 'not run' : 'fail';
    const mutation = payload?.observations?.mutation != null ? 'ok' : result.hermes.skipped ? 'not run' : 'fail';
    const serialization =
      payload?.observations?.serialization != null ? 'ok' : result.hermes.skipped ? 'not run' : 'fail';
    lines.push(
      `| ${result.platform} | ${result.mode} | ${result.metroResolution} | ${
        result.bundle.ok ? 'ok' : `fail (${result.bundle.status})`
      } | ${result.hermes.ok ? 'ok' : result.hermes.skipped ? 'not run' : `fail (${result.hermes.status})`} | ${parsing} | ${namespaces} | ${mutation} | ${serialization} |`
    );
  }
  lines.push('');
  lines.push('## jsdom semantic comparison');
  lines.push('');
  lines.push(
    `- Equivalent for checked XML/namespace/serialization fields: **${summary.namespaceEquivalence.equivalentForCheckedFields ? 'yes' : 'no'}**`
  );
  if (summary.namespaceEquivalence.differences.length > 0) {
    lines.push('- Differences:');
    for (const difference of summary.namespaceEquivalence.differences) {
      lines.push(
        `  - ${difference.field}: slimdom=${JSON.stringify(difference.slimdom)} vs jsdom=${JSON.stringify(difference.jsdom)}`
      );
    }
  }
  lines.push('');
  if (summary.reasons.length > 0) {
    lines.push('## Reasons');
    lines.push('');
    for (const reason of summary.reasons) {
      lines.push(`- ${reason}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const main = () => {
  ensureDir(outDir);

  const matrixResults = matrix.map((entry) => runMatrixEntry(entry));
  const portability = portabilityInspection();
  const nodeSlimdomProbe = runSlimdomHermesGateProbe();
  const namespaceComparison = compareAgainstJsdom(nodeSlimdomProbe);
  const summary = summarizeResults(matrixResults, portability, namespaceComparison);

  const jsonPath = path.join(outDir, 'm2.0-hermes-gate-results.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const mdPath = path.join(outDir, 'm2.0-hermes-gate-results.md');
  fs.writeFileSync(mdPath, writeMarkdown(summary), 'utf8');

  const failedMatrix = matrixResults.filter((result) => !result.bundle.ok || !result.hermes.ok);
  if (failedMatrix.length > 0) {
    console.log(
      `Gate executed with ${failedMatrix.length} matrix failures; see ${path.relative(repoRoot, jsonPath)}`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Gate executed successfully; see ${path.relative(repoRoot, jsonPath)}`);
};

main();
