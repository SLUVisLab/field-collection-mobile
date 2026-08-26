#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(__dirname, 'out');
const hermesBin = path.join(repoRoot, 'node_modules', 'react-native', 'sdks', 'hermesc', 'osx-bin', 'hermes');
const gatePrefix = 'M2_SLIMDOM_XFORMS_HERMES::';

const matrix = [
  { platform: 'android', mode: 'debug', dev: true, minify: false },
  { platform: 'ios', mode: 'debug', dev: true, minify: false },
  { platform: 'android', mode: 'release', dev: false, minify: true },
  { platform: 'ios', mode: 'release', dev: false, minify: true },
];

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

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
  return `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]`;
};

const parseGatePayload = (output) => {
  const line = output
    .split('\n')
    .find((entry) => entry.includes(gatePrefix));

  if (line == null) {
    return null;
  }

  const jsonText = line.slice(line.indexOf(gatePrefix) + gatePrefix.length).trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
};

const runDefaultImportResolutionCheck = () => {
  const bundlePath = path.join(outDir, 'default-import-check.bundle.js');
  const assetsDir = path.join(outDir, 'assets', 'default-import-check');
  ensureDir(path.dirname(bundlePath));
  ensureDir(assetsDir);

  const bundleArgs = [
    'react-native',
    'bundle',
    '--entry-file',
    'experiments/m2-slimdom-xforms/metroEntryDefaultImport.js',
    '--platform',
    'android',
    '--dev',
    'true',
    '--minify',
    'false',
    '--bundle-output',
    path.relative(repoRoot, bundlePath),
    '--assets-dest',
    path.relative(repoRoot, assetsDir),
    '--reset-cache',
  ];
  const bundleResult = run('npx', bundleArgs);

  return {
    ok: bundleResult.status === 0,
    status: bundleResult.status,
    stdout: trimOutput(bundleResult.stdout),
    stderr: trimOutput(bundleResult.stderr),
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
    'experiments/m2-slimdom-xforms/metroEntry.js',
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

const detectRuntimeTargets = () => {
  const ios = run('xcrun', ['simctl', 'list', 'devices', 'available']);
  const android = run('emulator', ['-list-avds']);

  const iosAvailableCount =
    ios.status === 0
      ? ios.stdout
          .split('\n')
          .filter((line) => line.includes('(') && !line.includes('unavailable')).length
      : 0;

  const androidAvailableCount =
    android.status === 0
      ? android.stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean).length
      : 0;

  return {
    ios: {
      checkStatus: ios.status,
      availableCount: iosAvailableCount,
      note:
        ios.status === 0
          ? iosAvailableCount > 0
            ? 'Simulators detected (not launched in this automated gate).'
            : 'No available simulators detected.'
          : `xcrun simctl unavailable: ${trimOutput(ios.stderr || ios.stdout)}`,
    },
    android: {
      checkStatus: android.status,
      availableCount: androidAvailableCount,
      note:
        android.status === 0
          ? androidAvailableCount > 0
            ? 'Android AVDs detected (not launched in this automated gate).'
            : 'No Android AVDs detected.'
          : `emulator command unavailable: ${trimOutput(android.stderr || android.stdout)}`,
    },
  };
};

const writeMarkdown = (summary) => {
  const lines = [];
  lines.push('# M2.3 Hermes runtime gate');
  lines.push('');
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Verdict: **${summary.verdict}**`);
  lines.push(`- Recommendation: ${summary.recommendation}`);
  lines.push('');
  lines.push('## Package default-import check');
  lines.push('');
  lines.push(
    `- \`require('@getodk/xforms-engine')\` Metro bundle result: ${
      summary.defaultImportCheck.ok ? 'ok' : `fail (${summary.defaultImportCheck.status})`
    }`
  );
  lines.push('');
  lines.push('## Matrix (Metro bundle + Hermes execution)');
  lines.push('');
  lines.push('| Platform | Mode | Metro resolution | Bundle success | Hermes execution | Probe success |');
  lines.push('|---|---|---|---|---|---|');
  for (const result of Object.values(summary.matrix)) {
    lines.push(
      `| ${result.platform} | ${result.mode} | ${result.metroResolution} | ${
        result.bundle.ok ? 'ok' : `fail (${result.bundle.status})`
      } | ${result.hermes.ok ? 'ok' : result.hermes.skipped ? 'not run' : `fail (${result.hermes.status})`} | ${
        result.hermes.gatePayload?.ok === true ? 'ok' : result.hermes.skipped ? 'not run' : 'fail'
      } |`
    );
  }
  lines.push('');
  lines.push('## App launch coverage');
  lines.push('');
  lines.push(`- Android target discovery: ${summary.runtimeTargets.android.note}`);
  lines.push(`- iOS target discovery: ${summary.runtimeTargets.ios.note}`);
  lines.push('- Actual simulator/device app-launch execution in this environment: **NOT RUN**');
  lines.push('');
  lines.push('## Verdict rationale');
  lines.push('');
  for (const reason of summary.reasons) {
    lines.push(`- ${reason}`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
};

const main = () => {
  ensureDir(outDir);

  const matrixResults = matrix.map((entry) => runMatrixEntry(entry));
  const runtimeTargets = detectRuntimeTargets();
  const defaultImportCheck = runDefaultImportResolutionCheck();

  const bundleFailures = matrixResults.filter((result) => !result.bundle.ok);
  const hermesFailures = matrixResults.filter((result) => result.bundle.ok && !result.hermes.ok);
  const probeFailures = matrixResults.filter(
    (result) => result.bundle.ok && result.hermes.ok && result.hermes.gatePayload?.ok !== true
  );

  const reasons = [];
  let verdict = 'GREEN';
  if (bundleFailures.length > 0 || hermesFailures.length > 0 || probeFailures.length > 0) {
    verdict = 'RED';
  }
  if (verdict !== 'RED') {
    verdict = 'YELLOW';
  }

  if (bundleFailures.length > 0) {
    reasons.push('Metro bundling failed for one or more matrix entries.');
  }
  if (hermesFailures.length > 0) {
    reasons.push('Hermes execution failed for one or more matrix entries.');
  }
  if (probeFailures.length > 0) {
    reasons.push('XForms probe checks failed during Hermes execution.');
  }
  if (bundleFailures.length > 0) {
    const firstBundleFailure = bundleFailures[0];
    const diagnostic = firstBundleFailure.bundle.stderr || firstBundleFailure.bundle.stdout;
    reasons.push(`First Metro failure (${firstBundleFailure.platform}-${firstBundleFailure.mode}): ${diagnostic.split('\n')[diagnostic.split('\n').findIndex((line) => line.toLowerCase().includes('error'))] ?? diagnostic.split('\n')[0]}`);
  }
  if (hermesFailures.length > 0) {
    const firstHermesFailure = hermesFailures[0];
    const diagnostic = firstHermesFailure.hermes.stderr || firstHermesFailure.hermes.stdout;
    reasons.push(`First Hermes failure (${firstHermesFailure.platform}-${firstHermesFailure.mode}): ${diagnostic.split('\n').find((line) => line.trim().length > 0) ?? 'Unknown Hermes failure'}`);
  }
  if (bundleFailures.length === 0 && hermesFailures.length === 0 && probeFailures.length === 0) {
    reasons.push(
      'Hermes CLI matrix passed, but final acceptance requires simulator/device app-launch validation (not run here).'
    );
  }
  if (!defaultImportCheck.ok) {
    reasons.push('Default package import (`@getodk/xforms-engine`) failed Metro resolution in this environment.');
  }

  const recommendation =
    verdict === 'RED'
      ? 'Stop and investigate Hermes/runtime incompatibilities before M3.'
      : 'Run the provided RN probe screen on Android and iOS release builds to finalize M2.3.';

  const summary = {
    generatedAt: new Date().toISOString(),
    runtimeTargets,
    defaultImportCheck,
    matrix: Object.fromEntries(matrixResults.map((result) => [`${result.platform}-${result.mode}`, result])),
    verdict,
    reasons,
    recommendation,
  };

  const jsonPath = path.join(outDir, 'm2.3-hermes-runtime.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const mdPath = path.join(outDir, 'm2.3-hermes-runtime.md');
  fs.writeFileSync(mdPath, writeMarkdown(summary), 'utf8');

  if (verdict === 'RED') {
    console.error(`M2.3 gate failed; see ${path.relative(repoRoot, mdPath)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`M2.3 gate completed (${verdict}); see ${path.relative(repoRoot, mdPath)}`);
};

main();
