#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(__dirname, 'out');
const hermesBin = path.join(appRoot, 'node_modules', 'react-native', 'sdks', 'hermesc', 'osx-bin', 'hermes');
const hermesVersionPropertiesPath = path.join(
  appRoot,
  'node_modules',
  'react-native',
  'sdks',
  'hermes-engine',
  'version.properties'
);

const matrix = [
  { platform: 'android', mode: 'debug', dev: true, minify: false },
  { platform: 'ios', mode: 'debug', dev: true, minify: false },
  { platform: 'android', mode: 'release', dev: false, minify: true },
  { platform: 'ios', mode: 'release', dev: false, minify: true },
];

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const run = (command, args, cwd = appRoot) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 100 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

const trim = (text, max = 10000) => {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]`;
};

const parsePayload = (output, prefix) => {
  const line = output.split('\n').find((value) => value.includes(prefix));
  if (line == null) {
    return null;
  }
  const jsonText = line.slice(line.indexOf(prefix) + prefix.length).trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
};

const analyzeXformsSyntax = () => {
  const distPath = path.join(appRoot, 'node_modules', '@getodk', 'xforms-engine', 'dist', 'index.js');
  const text = fs.readFileSync(distPath, 'utf8');
  const lines = text.split('\n');
  const detectBlobLineIndex = lines.findIndex((line) => line.includes('detectBlobBehavior'));
  const topLevelAwaitLineIndex = lines.findIndex((line) =>
    line.includes('const BLOB_BEHAVIOR = await detectBlobBehavior()')
  );
  const focusLine = topLevelAwaitLineIndex >= 0 ? topLevelAwaitLineIndex : detectBlobLineIndex;
  const sliceStart = Math.max(0, focusLine - 8);
  const sliceEnd = Math.min(lines.length, focusLine + 8);
  const excerpt = lines
    .slice(sliceStart, sliceEnd)
    .map((line, index) => `${sliceStart + index + 1}. ${line}`)
    .join('\n');

  return {
    distPath: path.relative(appRoot, distPath),
    detectBlobLine: detectBlobLineIndex + 1,
    hasTopLevelAwait: /const\s+BLOB_BEHAVIOR\s*=\s*await\s+detectBlobBehavior\(\)/.test(text),
    hasClassFields: /class\s+\w+[\s\S]*\n\s+\w+\s*=/.test(text),
    hasPrivateFields: /#\w+/.test(text),
    hasStaticInitializationBlock: /static\s*\{/.test(text),
    hasImportMeta: /import\.meta/.test(text),
    topLevelAwaitLine: topLevelAwaitLineIndex + 1,
    excerpt,
  };
};

const runEntry = (entry, modeName) => {
  const entryFile =
    modeName === 'default' ? 'gate/metroEntryDefault.js' : 'gate/metroEntryDist.js';
  const payloadPrefix = modeName === 'default' ? 'M23A_DEFAULT_IMPORT::' : 'M23A_DIST_IMPORT::';

  const baseName = `${modeName}-${entry.platform}-${entry.mode}`;
  const bundlePath = path.join(outDir, `${baseName}.bundle.js`);
  const assetsDir = path.join(outDir, 'assets', baseName);
  ensureDir(path.dirname(bundlePath));
  ensureDir(assetsDir);

  const bundleArgs = [
    'react-native',
    'bundle',
    '--entry-file',
    path.join(appRoot, entryFile),
    '--platform',
    entry.platform,
    '--dev',
    String(entry.dev),
    '--minify',
    String(entry.minify),
    '--bundle-output',
    bundlePath,
    '--assets-dest',
    assetsDir,
    '--reset-cache',
  ];

  const reactNativeCli = path.join(appRoot, 'node_modules', '.bin', 'react-native');
  const bundleResult = run(reactNativeCli, bundleArgs.slice(1));
  if (bundleResult.status !== 0) {
    return {
      modeName,
      ...entry,
      metroResolution: 'fail',
      bundle: {
        ok: false,
        status: bundleResult.status,
        stdout: trim(bundleResult.stdout),
        stderr: trim(bundleResult.stderr),
      },
      hermes: {
        ok: false,
        skipped: true,
      },
    };
  }

  if (!fs.existsSync(hermesBin)) {
    return {
      modeName,
      ...entry,
      metroResolution: 'ok',
      bundle: {
        ok: true,
        status: 0,
        outputPath: path.relative(appRoot, bundlePath),
        stdout: trim(bundleResult.stdout),
        stderr: trim(bundleResult.stderr),
      },
      hermes: {
        ok: false,
        skipped: true,
        reason: `Hermes CLI binary not found at ${path.relative(appRoot, hermesBin)}`,
      },
    };
  }

  const hermesResult = run(hermesBin, [bundlePath]);
  const combined = `${hermesResult.stdout}\n${hermesResult.stderr}`;
  const payload = parsePayload(combined, payloadPrefix);

  return {
    modeName,
    ...entry,
    metroResolution: 'ok',
    bundle: {
      ok: true,
      status: 0,
      outputPath: path.relative(appRoot, bundlePath),
      stdout: trim(bundleResult.stdout),
      stderr: trim(bundleResult.stderr),
    },
    hermes: {
      ok: hermesResult.status === 0,
      status: hermesResult.status,
      payload,
      stdout: trim(hermesResult.stdout),
      stderr: trim(hermesResult.stderr),
    },
  };
};

const gatherVersions = () => {
  const packageJson = require(path.join(appRoot, 'package.json'));
  const rnPackage = require(path.join(appRoot, 'node_modules', 'react-native', 'package.json'));
  const metroVersion = run('node', ['-e', "console.log(require('metro/package.json').version)"], appRoot).stdout.trim();
  const expoVersion = run('npx', ['expo', '--version']).stdout.trim();
  let hermesVersion = 'unknown';
  if (fs.existsSync(hermesBin)) {
    const hermesResult = run(hermesBin, ['-version']);
    hermesVersion = (hermesResult.stdout.trim() || hermesResult.stderr.trim()).replace(/\s+/g, ' ').trim();
  } else if (fs.existsSync(hermesVersionPropertiesPath)) {
    const versionProperties = fs.readFileSync(hermesVersionPropertiesPath, 'utf8');
    const match = /^HERMES_VERSION_NAME=(.+)$/m.exec(versionProperties);
    hermesVersion = match?.[1] ?? 'from version.properties (unparsed)';
  }

  return {
    node: process.version,
    expo: packageJson.dependencies.expo,
    expoCli: expoVersion,
    reactNative: packageJson.dependencies['react-native'],
    reactNativePackageVersion: rnPackage.version,
    metro: metroVersion,
    hermes: hermesVersion,
  };
};

const writeMarkdown = (summary) => {
  const lines = [];
  lines.push('# M2.3a current Expo/Hermes gate');
  lines.push('');
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Preliminary bundle/Hermes verdict: **${summary.preliminaryVerdict}**`);
  lines.push('');
  lines.push('## Versions');
  lines.push('');
  lines.push(`- Expo SDK: \`${summary.versions.expo}\``);
  lines.push(`- Expo CLI: \`${summary.versions.expoCli}\``);
  lines.push(`- React Native: \`${summary.versions.reactNative}\``);
  lines.push(`- Metro: \`${summary.versions.metro}\``);
  lines.push(`- Hermes: \`${summary.versions.hermes}\``);
  lines.push(`- Node: \`${summary.versions.node}\``);
  lines.push('');
  lines.push('## ODK syntax analysis (dist/index.js)');
  lines.push('');
  lines.push(`- Source: \`${summary.syntax.distPath}\``);
  lines.push(`- detectBlobBehavior line: ${summary.syntax.detectBlobLine}`);
  lines.push(`- Top-level await line: ${summary.syntax.topLevelAwaitLine}`);
  lines.push(`- Top-level await present: ${summary.syntax.hasTopLevelAwait}`);
  lines.push(`- Class fields present: ${summary.syntax.hasClassFields}`);
  lines.push(`- Private fields present: ${summary.syntax.hasPrivateFields}`);
  lines.push(`- Static initialization blocks present: ${summary.syntax.hasStaticInitializationBlock}`);
  lines.push(`- import.meta present: ${summary.syntax.hasImportMeta}`);
  lines.push('');
  lines.push('```js');
  lines.push(summary.syntax.excerpt);
  lines.push('```');
  lines.push('');
  lines.push('## Matrix (bundle + Hermes)');
  lines.push('');
  lines.push('| Import mode | Platform | Build mode | Metro resolution | Bundle success | Hermes exec | Probe |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const result of summary.results) {
    lines.push(
      `| ${result.modeName} | ${result.platform} | ${result.mode} | ${result.metroResolution} | ${
        result.bundle.ok ? 'ok' : `fail (${result.bundle.status})`
      } | ${result.hermes.ok ? 'ok' : result.hermes.skipped ? 'not run' : `fail (${result.hermes.status})`} | ${
        result.hermes.payload?.ok === true ? 'ok' : result.hermes.skipped ? 'not run' : 'fail'
      } |`
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
};

const main = () => {
  ensureDir(outDir);

  const versions = gatherVersions();
  const syntax = analyzeXformsSyntax();

  const results = [];
  for (const entry of matrix) {
    results.push(runEntry(entry, 'default'));
  }
  for (const entry of matrix) {
    results.push(runEntry(entry, 'dist'));
  }

  const defaultReleasePass = results.some(
    (result) =>
      result.modeName === 'default' &&
      result.mode === 'release' &&
      result.bundle.ok &&
      result.hermes.ok &&
      result.hermes.payload?.ok === true
  );
  const defaultAnyFailure = results.some(
    (result) =>
      result.modeName === 'default' &&
      (!result.bundle.ok || !result.hermes.ok || result.hermes.payload?.ok !== true)
  );

  let preliminaryVerdict = 'GREEN';
  if (!defaultReleasePass || defaultAnyFailure) {
    preliminaryVerdict = 'RED';
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    versions,
    syntax,
    results,
    preliminaryVerdict,
  };

  const jsonPath = path.join(outDir, 'm2.3a-gate-results.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const mdPath = path.join(outDir, 'm2.3a-gate-results.md');
  fs.writeFileSync(mdPath, writeMarkdown(summary), 'utf8');

  console.log(`M2.3a gate written to ${path.relative(appRoot, mdPath)}`);
};

main();
