#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const babel = require('@babel/core');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(__dirname, 'out');
const hermesBin = path.join(repoRoot, 'node_modules', 'react-native', 'sdks', 'hermesc', 'osx-bin', 'hermes');
const gatePrefix = 'M2_OOZCITAK_HERMES_GATE::';

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

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const summarizeBundleTransforms = (bundleText) => {
  const checks = {
    containsPrototypeConstDefinition: /defineProperty\([^)]*"_ID"[^)]*writable:\s*!?1|writable:\s*false/.test(
      bundleText
    ),
    containsFieldAssignmentSyntax: /\b_ID\s*=/.test(bundleText),
    containsConstructorAssignmentSyntax: /this\._ID\s*=/.test(bundleText),
    containsReadOnlyErrorString: /read only property|Cannot assign to read only property/i.test(bundleText),
  };

  return checks;
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

const runIssue22TranspileChecks = () => {
  const pocCode = `
class Test {
  _ID = '1';
}
Object.defineProperty(Test.prototype, '_ID', { writable: false });
new Test();
`;

  const babelConfigPath = path.join(repoRoot, 'babel.config.js');

  const pocTransformed = babel.transformSync(pocCode, {
    configFile: babelConfigPath,
    babelrc: false,
    filename: 'issue22-poc.js',
    sourceType: 'script',
  });

  const transformedPocCode = pocTransformed?.code ?? '';
  let pocRuntimeError = null;
  try {
    vm.runInNewContext(
      transformedPocCode,
      {
        require,
        module: { exports: {} },
        exports: {},
      },
      { timeout: 1000 }
    );
  } catch (error) {
    const resolvedError =
      error instanceof Error ? error : new Error(`Unknown PoC execution error: ${String(error)}`);
    pocRuntimeError = {
      name: resolvedError.name,
      message: resolvedError.message,
    };
  }

  const domImplPath = path.join(repoRoot, 'node_modules', '@oozcitak', 'dom', 'lib', 'dom', 'DOMImplementationImpl.js');
  const domImplCode = fs.readFileSync(domImplPath, 'utf8');
  const domImplTransformed = babel.transformSync(domImplCode, {
    configFile: babelConfigPath,
    babelrc: false,
    filename: domImplPath,
    sourceType: 'module',
  });

  const transformedDomImplCode = domImplTransformed?.code ?? '';

  return {
    poc: {
      transformedContainsFieldSyntax: /class\s+Test[\s\S]*?_ID\s*=/.test(transformedPocCode),
      transformedContainsConstructorAssignment: /this\._ID\s*=/.test(transformedPocCode),
      runtimeReadOnlyTypeError:
        pocRuntimeError != null && /read only property|cannot assign to read only property/i.test(pocRuntimeError.message),
      runtimeError: pocRuntimeError,
    },
    domImplementationFile: {
      file: path.relative(repoRoot, domImplPath),
      transformedContainsFieldSyntax: /class\s+DOMImplementationImpl[\s\S]*?_ID\s*=/.test(transformedDomImplCode),
      transformedContainsConstructorAssignment: /this\._ID\s*=/.test(transformedDomImplCode),
      transformedContainsPrototypeConstDefinition:
        /idl_defineConst[\s\S]{0,120}["_']_ID["_']/.test(transformedDomImplCode),
    },
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
    'experiments/m2-oozcitak-hermes-gate/metroEntry.js',
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
      bundle: {
        ok: false,
        status: bundleResult.status,
        stdout: bundleResult.stdout,
        stderr: bundleResult.stderr,
      },
      hermes: {
        ok: false,
        skipped: true,
      },
    };
  }

  const bundleText = readText(bundlePath);
  const bundleChecks = summarizeBundleTransforms(bundleText);

  const hermesResult = run(hermesBin, [bundlePath]);
  const combinedOutput = `${hermesResult.stdout}\n${hermesResult.stderr}`;
  const gatePayload = parseGatePayload(combinedOutput);
  const issue22Reproduced =
    /read only property|Cannot assign to read only property/i.test(combinedOutput) ||
    (gatePayload != null && gatePayload.issue22Reproduced === true);

  return {
    ...entry,
    bundle: {
      ok: true,
      status: 0,
      checks: bundleChecks,
      outputPath: path.relative(repoRoot, bundlePath),
      stdout: bundleResult.stdout,
      stderr: bundleResult.stderr,
    },
    hermes: {
      ok: hermesResult.status === 0,
      status: hermesResult.status,
      issue22Reproduced,
      gatePayload,
      stdout: hermesResult.stdout,
      stderr: hermesResult.stderr,
    },
  };
};

const summarize = (results) => {
  const byKey = Object.fromEntries(results.map((r) => [`${r.platform}-${r.mode}`, r]));
  const releasePlatformsSucceeded = results.filter(
    (r) => r.mode === 'release' && r.bundle.ok && r.hermes.ok
  );
  const anyIssue22 = results.some((r) => r.hermes.issue22Reproduced === true);
  const transpileChecks = runIssue22TranspileChecks();
  const metroBundleFailure = results.some((r) => !r.bundle.ok);
  const hermesFailure = results.some((r) => r.bundle.ok && !r.hermes.ok);

  let verdict = 'GREEN';
  let recommendation = 'Proceed with @oozcitak/dom as the primary M2 candidate.';
  const reasons = [];

  if (metroBundleFailure) {
    verdict = 'RED';
    reasons.push('Metro cannot resolve Node core module "url" from @oozcitak/url dependency.');
  }

  if (hermesFailure) {
    verdict = 'RED';
    reasons.push('Hermes execution failed for at least one bundled matrix entry.');
  }

  if (anyIssue22 || transpileChecks.poc.runtimeReadOnlyTypeError) {
    verdict = 'RED';
    reasons.push('Issue #22 read-only assignment failure pattern reproduced.');
  }

  if (verdict === 'RED') {
    recommendation = 'Stop @oozcitak/dom and run the same Hermes gate with slimdom.';
  }

  return {
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    yarnVersion: run('yarn', ['-v']).stdout.trim(),
    hermesBinary: path.relative(repoRoot, hermesBin),
    matrix: byKey,
    releasePlatformsSucceeded: releasePlatformsSucceeded.map((r) => r.platform),
    issue22Reproduced: anyIssue22,
    issue22TranspileChecks: transpileChecks,
    verdict,
    recommendation,
    reasons,
  };
};

const writeMarkdown = (summary) => {
  const lines = [];
  lines.push('# M2.0 @oozcitak/dom Hermes gate');
  lines.push('');
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Node: ${summary.nodeVersion}`);
  lines.push(`- Yarn: ${summary.yarnVersion}`);
  lines.push(`- Hermes binary: \`${summary.hermesBinary}\``);
  lines.push(`- Issue #22 reproduced: **${summary.issue22Reproduced ? 'yes' : 'no'}**`);
  lines.push(`- Verdict: **${summary.verdict}**`);
  lines.push(`- Recommendation: ${summary.recommendation}`);
  if (summary.reasons.length > 0) {
    for (const reason of summary.reasons) {
      lines.push(`- Reason: ${reason}`);
    }
  }
  lines.push('');
  lines.push('| Platform | Mode | Metro bundle | Hermes exec | Issue #22 pattern |');
  lines.push('|---|---|---|---|---|');

  for (const [key, result] of Object.entries(summary.matrix)) {
    lines.push(
      `| ${result.platform} | ${result.mode} | ${result.bundle.ok ? 'ok' : 'fail'} | ${
        result.hermes.ok ? 'ok' : result.hermes.skipped ? 'skipped' : 'fail'
      } | ${result.hermes.issue22Reproduced ? 'yes' : 'no'} |`
    );
  }

  lines.push('');
  for (const [key, result] of Object.entries(summary.matrix)) {
    lines.push(`## ${key}`);
    lines.push('');
    lines.push('- Metro bundle status: ' + (result.bundle.ok ? 'ok' : `fail (${result.bundle.status})`));
    if (result.bundle.ok) {
      const c = result.bundle.checks;
      lines.push(`- Bundle checks: _ID field syntax=${c.containsFieldAssignmentSyntax}, constructor assignment=${c.containsConstructorAssignmentSyntax}, prototype const define=${c.containsPrototypeConstDefinition}`);
    }
    lines.push('- Hermes execution: ' + (result.hermes.ok ? 'ok' : result.hermes.skipped ? 'skipped' : `fail (${result.hermes.status})`));
    if (result.hermes.gatePayload != null) {
      lines.push(`- Probe ok: ${result.hermes.gatePayload.ok}`);
      lines.push(`- HermesInternal present: ${result.hermes.gatePayload.runtime?.hermesInternal === true}`);
    }
    lines.push('');
  }

  lines.push('## Issue #22 transpilation checks (Gather Babel config)');
  lines.push('');
  lines.push(`- PoC transformed contains class-field syntax: ${summary.issue22TranspileChecks.poc.transformedContainsFieldSyntax}`);
  lines.push(
    `- PoC transformed contains constructor assignment: ${summary.issue22TranspileChecks.poc.transformedContainsConstructorAssignment}`
  );
  lines.push(
    `- PoC runtime read-only TypeError: ${summary.issue22TranspileChecks.poc.runtimeReadOnlyTypeError}`
  );
  if (summary.issue22TranspileChecks.poc.runtimeError != null) {
    lines.push(
      `- PoC runtime error: ${summary.issue22TranspileChecks.poc.runtimeError.name}: ${summary.issue22TranspileChecks.poc.runtimeError.message}`
    );
  }
  lines.push(
    `- DOMImplementation transformed contains field syntax: ${summary.issue22TranspileChecks.domImplementationFile.transformedContainsFieldSyntax}`
  );
  lines.push(
    `- DOMImplementation transformed contains constructor assignment: ${summary.issue22TranspileChecks.domImplementationFile.transformedContainsConstructorAssignment}`
  );
  lines.push(
    `- DOMImplementation transformed contains prototype const define: ${summary.issue22TranspileChecks.domImplementationFile.transformedContainsPrototypeConstDefinition}`
  );
  lines.push('');

  return `${lines.join('\n')}\n`;
};

const main = () => {
  ensureDir(outDir);

  const results = matrix.map((entry) => runMatrixEntry(entry));
  const summary = summarize(results);

  const jsonPath = path.join(outDir, 'm2.0-hermes-gate-results.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const mdPath = path.join(outDir, 'm2.0-hermes-gate-results.md');
  fs.writeFileSync(mdPath, writeMarkdown(summary), 'utf8');

  const failing = results.filter((r) => !r.bundle.ok || !r.hermes.ok);
  if (failing.length > 0) {
    console.log(`Gate executed with ${failing.length} matrix failures; see ${path.relative(repoRoot, jsonPath)}`);
  } else {
    console.log(`Gate executed successfully; see ${path.relative(repoRoot, jsonPath)}`);
  }
};

main();
