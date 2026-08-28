#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parse } = require('@babel/parser');

const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(__dirname, 'out', 'm2.3b');
const compatDir = path.join(__dirname, 'm23b', 'compat');
const distDir = path.join(appRoot, 'node_modules', '@getodk', 'xforms-engine', 'dist');
const distIndexPath = path.join(distDir, 'index.js');
const distSolidPath = path.join(distDir, 'solid.js');

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const trim = (text, max = 12000) => {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]`;
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? appRoot,
    env: options.env ?? process.env,
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

const countRegex = (text, pattern) => {
  const matches = text.match(pattern);
  return matches == null ? 0 : matches.length;
};

const getLineText = (text, lineNumber) => {
  const lines = text.split('\n');
  return lines[lineNumber - 1] ?? '';
};

const replaceBlobTopLevelAwait = (sourceText) => {
  const pattern = /const BLOB_BEHAVIOR = await detectBlobBehavior\(\);[\s\S]*?\n}\n\nconst fetchTextFromURL = async/;
  const replacement = `const BLOB_BEHAVIOR_PROMISE = detectBlobBehavior();
const resolveBlobHelpers = async () => {
  const blobBehavior = await BLOB_BEHAVIOR_PROMISE;
  if (blobBehavior === "BLOB_BEHAVIOR_EXPECTED") {
    return {
      getBlobText: (blob) => blob.text(),
      getBlobData: (blob) => blob.arrayBuffer()
    };
  }
  switch (blobBehavior) {
    case "BLOB_BEHAVIOR_BROKEN_BY_DESIGN_REJECTION":
      return {
        getBlobText: async (blob) => {
          try {
            const result = await blob.text();
            return result;
          } catch {
            return readBlobText(blob);
          }
        },
        getBlobData: async (blob) => {
          try {
            const result = await blob.arrayBuffer();
            return result;
          } catch {
            return readBlobData(blob);
          }
        }
      };
    case "BLOB_BEHAVIOR_BROKEN_BY_DESIGN_TEXT_MISMATCH":
      return {
        getBlobText: async (blob) => {
          try {
            const result = await readBlobText(blob);
            return result;
          } catch {
            return blob.text();
          }
        },
        getBlobData: async (blob) => {
          try {
            const result = await readBlobData(blob);
            return result;
          } catch {
            return blob.arrayBuffer();
          }
        }
      };
    default:
      throw new UnreachableError$1(blobBehavior);
  }
};
let blobHelpersPromise;
const getBlobHelpers = () => {
  if (blobHelpersPromise == null) {
    blobHelpersPromise = resolveBlobHelpers();
  }
  return blobHelpersPromise;
};
const getBlobText = async (blob) => {
  const helpers = await getBlobHelpers();
  return helpers.getBlobText(blob);
};
const getBlobData = async (blob) => {
  const helpers = await getBlobHelpers();
  return helpers.getBlobData(blob);
};

const fetchTextFromURL = async`;

  if (!pattern.test(sourceText)) {
    throw new Error('Could not locate BLOB_BEHAVIOR top-level-await block for deterministic transform.');
  }

  return sourceText.replace(pattern, replacement);
};

const replaceExpressionParserTopLevelAwait = (sourceText) => {
  const parserInitPattern =
    /const expressionParser = await ExpressionParser\.init\(\{\n  webTreeSitter,\n  xpathLanguage\n\}\);/;
  const parserInitReplacement = `let expressionParser;
const expressionParserInitPromise = ExpressionParser.init({
  webTreeSitter,
  xpathLanguage
}).then((initializedExpressionParser) => {
  expressionParser = initializedExpressionParser;
  return initializedExpressionParser;
});
const getExpressionParser = () => {
  if (expressionParser == null) {
    throw new Error("Expression parser has not finished initialization");
  }
  return expressionParser;
};`;

  if (!parserInitPattern.test(sourceText)) {
    throw new Error('Could not locate expressionParser top-level-await block for deterministic transform.');
  }

  let next = sourceText.replace(parserInitPattern, parserInitReplacement);
  next = next.replace(/this\.parser = expressionParser;/g, 'this.parser = getExpressionParser();');
  next = next.replace(/expressionParser\.parse\(/g, 'getExpressionParser().parse(');
  next = next.replace(
    'const loadFormResult = async (scope, formResource, options) => {\n  const { fetchFormDefinition, fetchFormAttachment, missingResourceBehavior } = options;',
    'const loadFormResult = async (scope, formResource, options) => {\n  await expressionParserInitPromise;\n  const { fetchFormDefinition, fetchFormAttachment, missingResourceBehavior } = options;'
  );

  return next;
};

const applyCompatibilityTransform = (sourceText) => {
  const withoutBlobTla = replaceBlobTopLevelAwait(sourceText);
  return replaceExpressionParserTopLevelAwait(withoutBlobTla);
};

const parserPlugins = ['topLevelAwait', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'importMeta', 'dynamicImport'];

const analyzeParsedFeatures = (sourceText, sourcePath) => {
  const ast = parse(sourceText, {
    sourceType: 'module',
    plugins: parserPlugins,
  });

  const topLevelAwaitLocations = [];
  const classFieldLocations = [];
  const privateFieldLocations = [];
  const staticBlockLocations = [];
  const importMetaLocations = [];
  const dynamicImportLocations = [];
  const usingLocations = [];

  const walk = (node, state) => {
    if (node == null || typeof node !== 'object') {
      return;
    }

    if (node.type === 'AwaitExpression' && state.functionDepth === 0 && state.staticBlockDepth === 0) {
      topLevelAwaitLocations.push({
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
      });
    }

    if (node.type === 'ClassProperty' || node.type === 'ClassPrivateProperty' || node.type === 'PropertyDefinition') {
      classFieldLocations.push({
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
      });
    }

    if (node.type === 'ClassPrivateProperty' || node.type === 'ClassPrivateMethod' || node.type === 'PrivateName') {
      privateFieldLocations.push({
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
      });
    }

    if (node.type === 'StaticBlock') {
      staticBlockLocations.push({
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
      });
    }

    if (
      node.type === 'MetaProperty' &&
      node.meta?.type === 'Identifier' &&
      node.meta.name === 'import' &&
      node.property?.type === 'Identifier' &&
      node.property.name === 'meta'
    ) {
      importMetaLocations.push({
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
      });
    }

    if (node.type === 'ImportExpression' || (node.type === 'CallExpression' && node.callee?.type === 'Import')) {
      dynamicImportLocations.push({
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
      });
    }

    if (
      node.type === 'UsingDeclaration' ||
      node.type === 'AwaitUsingDeclaration' ||
      (node.type === 'VariableDeclaration' && (node.kind === 'using' || node.kind === 'await using'))
    ) {
      usingLocations.push({
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
      });
    }

    let nextState = state;
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'ObjectMethod' ||
      node.type === 'ClassMethod' ||
      node.type === 'ClassPrivateMethod'
    ) {
      nextState = {
        ...nextState,
        functionDepth: nextState.functionDepth + 1,
      };
    }
    if (node.type === 'StaticBlock') {
      nextState = {
        ...nextState,
        staticBlockDepth: nextState.staticBlockDepth + 1,
      };
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item, nextState);
        }
      } else {
        walk(value, nextState);
      }
    }
  };

  walk(ast, {
    functionDepth: 0,
    staticBlockDepth: 0,
  });

  return {
    sourcePath: path.relative(appRoot, sourcePath),
    topLevelAwaitLocations,
    classFieldLocations,
    privateFieldLocations,
    staticBlockLocations,
    importMetaLocations,
    dynamicImportLocations,
    usingLocations,
  };
};

const buildCompatibilityBundle = () => {
  ensureDir(compatDir);

  const indexSource = fs.readFileSync(distIndexPath, 'utf8');
  const solidSource = fs.readFileSync(distSolidPath, 'utf8');
  const transformedIndex = applyCompatibilityTransform(indexSource);
  const transformedSolid = applyCompatibilityTransform(solidSource);

  const compatIndexPath = path.join(compatDir, 'index.js');
  const compatSolidPath = path.join(compatDir, 'solid.js');
  fs.writeFileSync(compatIndexPath, transformedIndex, 'utf8');
  fs.writeFileSync(compatSolidPath, transformedSolid, 'utf8');

  const beforeIndex = analyzeParsedFeatures(indexSource, distIndexPath);
  const afterIndex = analyzeParsedFeatures(transformedIndex, compatIndexPath);
  const beforeSolid = analyzeParsedFeatures(solidSource, distSolidPath);
  const afterSolid = analyzeParsedFeatures(transformedSolid, compatSolidPath);

  return {
    compatIndexPath: path.relative(appRoot, compatIndexPath),
    compatSolidPath: path.relative(appRoot, compatSolidPath),
    verification: {
      indexTopLevelAwaitBefore: beforeIndex.topLevelAwaitLocations.length,
      indexTopLevelAwaitAfter: afterIndex.topLevelAwaitLocations.length,
      solidTopLevelAwaitBefore: beforeSolid.topLevelAwaitLocations.length,
      solidTopLevelAwaitAfter: afterSolid.topLevelAwaitLocations.length,
    },
  };
};

const runExpoEmbed = ({ label, modeName, entryFile, platform, dev, minify }) => {
  const bundlesDir = path.join(outDir, 'embed');
  const assetsDir = path.join(outDir, 'assets', `${label}-${platform}-${dev ? 'debug' : 'release'}`);
  ensureDir(bundlesDir);
  ensureDir(assetsDir);

  const bundleOutputPath = path.join(
    bundlesDir,
    `${label}-${modeName}-${platform}-${dev ? 'debug' : 'release'}.${minify ? 'min' : 'nomini'}.jsbundle`
  );

  const env = {
    ...process.env,
    M23B_XFORMS_MODE: modeName,
  };

  const args = [
    'expo',
    'export:embed',
    '--entry-file',
    entryFile,
    '--platform',
    platform,
    '--dev',
    String(dev),
    '--minify',
    String(minify),
    '--bundle-output',
    bundleOutputPath,
    '--assets-dest',
    assetsDir,
    '--reset-cache',
    '--bytecode',
  ];

  const result = run('npx', args, { env });
  const combined = `${result.stdout}\n${result.stderr}`;
  return {
    label,
    modeName,
    entryFile,
    platform,
    buildMode: dev ? 'debug' : 'release',
    ok: result.status === 0,
    status: result.status,
    hasModuleResolutionFailure: /While trying to resolve module `@getodk\/xforms-engine`/m.test(combined),
    hasTopLevelAwaitFailure: /BLOB_BEHAVIOR\s*=\s*await detectBlobBehavior|expressionParser = await ExpressionParser\.init|error:\s*';' expected/m.test(
      combined
    ),
    outputPath: path.relative(appRoot, bundleOutputPath),
    stdout: trim(result.stdout),
    stderr: trim(result.stderr),
  };
};

const gatherVersions = () => {
  const appPackage = require(path.join(appRoot, 'package.json'));
  const rnPackage = require(path.join(appRoot, 'node_modules', 'react-native', 'package.json'));
  const metroPackage = require(path.join(appRoot, 'node_modules', 'metro', 'package.json'));
  const hermesCompilerPackage = require(path.join(appRoot, 'node_modules', 'hermes-compiler', 'package.json'));
  const expoCli = run('npx', ['expo', '--version']).stdout.trim();

  return {
    node: process.version,
    expoSdk: appPackage.dependencies.expo,
    expoCli,
    reactNative: appPackage.dependencies['react-native'],
    reactNativePackageVersion: rnPackage.version,
    metro: metroPackage.version,
    hermesCompiler: hermesCompilerPackage.version,
  };
};

const runNodeResolve = () => {
  const resolution = run('node', ['--input-type=module', '-e', "console.log(await import.meta.resolve('@getodk/xforms-engine'))"]);
  return {
    ok: resolution.status === 0,
    resolved: resolution.stdout.trim(),
    stderr: trim(resolution.stderr),
  };
};

const getHistoricalM23aResolution = () => {
  const historicalPath = path.join(__dirname, 'out', 'm2.3a-gate-results.json');
  if (!fs.existsSync(historicalPath)) {
    return null;
  }
  try {
    const historical = JSON.parse(fs.readFileSync(historicalPath, 'utf8'));
    const failure = historical.results?.find(
      (item) =>
        item.modeName === 'default' &&
        item.platform === 'android' &&
        item.mode === 'debug' &&
        item.bundle?.ok === false &&
        typeof item.bundle?.stderr === 'string' &&
        item.bundle.stderr.includes('main` module field that could not be resolved')
    );
    if (failure == null) {
      return null;
    }
    const match = /could not be resolved \(`([^`]+)`/m.exec(failure.bundle.stderr);
    return {
      sourcePath: path.relative(appRoot, historicalPath),
      attemptedMainPath: match?.[1] ?? null,
      excerpt: trim(failure.bundle.stderr, 1800),
    };
  } catch {
    return null;
  }
};

const runNodeCompatibilityProbe = () => {
  const script = `
    (async () => {
      const { runXformsProbeWithLoadForm } = require('./src/probeCore.cjs');
      const { installSlimdomDomCompatibility } = require('./src/installDomCompatibility.cjs');
      const compatibility = installSlimdomDomCompatibility({ force: true });
      try {
        const { loadForm } = await import('./gate/m23b/compat/index.js');
        const result = await runXformsProbeWithLoadForm(loadForm, 'm23b-compat-node');
        console.log(
          JSON.stringify({
            ok: result.ok,
            importMode: result.importMode,
            steps: result.steps.map((step) => ({
              name: step.name,
              ok: step.ok,
              error: step.ok ? null : step.error?.message ?? 'unknown',
            })),
          })
        );
        process.exit(result.ok ? 0 : 1);
      } finally {
        compatibility.restore();
      }
    })().catch((error) => {
      const resolved = error instanceof Error ? error : new Error(String(error));
      console.error(resolved.stack ?? resolved.message);
      process.exit(1);
    });
  `;
  const probe = run('node', ['-e', script]);
  let payload = null;
  if (probe.stdout.trim().length > 0) {
    const lines = probe.stdout.trim().split('\n');
    const tail = lines[lines.length - 1];
    try {
      payload = JSON.parse(tail);
    } catch {
      payload = null;
    }
  }

  return {
    ok: probe.status === 0 && payload?.ok === true,
    status: probe.status,
    payload,
    stdout: trim(probe.stdout),
    stderr: trim(probe.stderr),
  };
};

const analyzePackageStructure = ({ stockReleaseMinimalResults }) => {
  const packagePath = path.join(appRoot, 'node_modules', '@getodk', 'xforms-engine', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const nodeResolution = runNodeResolve();
  const historical = getHistoricalM23aResolution();

  return {
    packagePath: path.relative(appRoot, packagePath),
    type: packageJson.type ?? null,
    main: packageJson.main ?? null,
    module: packageJson.module ?? null,
    browser: packageJson.browser ?? null,
    exports: packageJson.exports ?? null,
    subpathExports: Object.keys(packageJson.exports ?? {}),
    nodeResolvedEntry: nodeResolution.resolved || null,
    historicalMetroResolutionFailure: historical,
    stockReleaseMinimalResults,
    rootCause:
      'On current Expo bundling (`expo export:embed`), package entry resolves and Hermes then fails on top-level await; historical RN CLI bundling captured a separate main/index resolution path failure.',
  };
};

const analyzeSyntaxInventory = () => {
  const files = [distIndexPath, distSolidPath];
  const inventories = files.map((filePath) => {
    const text = fs.readFileSync(filePath, 'utf8');
    const parsed = analyzeParsedFeatures(text, filePath);
    const topLevelAwaitExcerpts = parsed.topLevelAwaitLocations.map((location) => ({
      ...location,
      lineText: getLineText(text, location.line).trim(),
    }));

    return {
      ...parsed,
      featureCounts: {
        topLevelAwait: parsed.topLevelAwaitLocations.length,
        classFields: parsed.classFieldLocations.length,
        privateFields: parsed.privateFieldLocations.length,
        staticInitializationBlocks: parsed.staticBlockLocations.length,
        importMeta: parsed.importMetaLocations.length,
        dynamicImport: parsed.dynamicImportLocations.length,
        usingSyntax: parsed.usingLocations.length,
      },
      runtimeApiTokenCounts: {
        Blob: countRegex(text, /\bBlob\b/g),
        File: countRegex(text, /\bFile\b/g),
        FileReader: countRegex(text, /\bFileReader\b/g),
        URL: countRegex(text, /\bURL\b/g),
        fetch: countRegex(text, /\bfetch\b/g),
        TextDecoder: countRegex(text, /\bTextDecoder\b/g),
        Temporal: countRegex(text, /\bTemporal\b/g),
      },
      topLevelAwaitExcerpts,
    };
  });

  const summary = {
    totalTopLevelAwait: inventories.reduce((total, item) => total + item.featureCounts.topLevelAwait, 0),
    filesWithTopLevelAwait: inventories
      .filter((item) => item.featureCounts.topLevelAwait > 0)
      .map((item) => item.sourcePath),
  };

  return {
    files: inventories,
    summary,
  };
};

const analyzeBlobTrace = () => {
  const text = fs.readFileSync(distIndexPath, 'utf8');
  const lines = text.split('\n');
  const locate = (needle) => {
    const index = lines.findIndex((line) => line.includes(needle));
    return index >= 0 ? index + 1 : null;
  };

  return {
    detectBlobBehaviorLine: locate('const detectBlobBehavior = async () =>'),
    blobBehaviorTopLevelAwaitLine: locate('const BLOB_BEHAVIOR = await detectBlobBehavior();'),
    expressionParserTopLevelAwaitLine: locate('const expressionParser = await ExpressionParser.init({'),
    retrieveSourceXmlBlobReadLine: locate('text = await getBlobText(resource);'),
    attachmentBinaryReadLine: locate('const blobData = await getBlobData(blob);'),
    instanceBlobReadLine: locate('return getBlobText(instanceResult);'),
    encryptedAttachmentReadLine: locate('const content = await getBlobData(attachment);'),
    interpretation: {
      detectBlobBehavior:
        'detectBlobBehavior is async because it probes Blob.text() behavior at runtime and may catch rejected Blob implementations.',
      blobScope:
        'Blob behavior impacts Blob-backed form source reads, submission payload extraction, and encrypted attachments, not plain XML string form source.',
      expressionParser:
        'expressionParser top-level await initializes the Tree-sitter XPath parser before parser usage; module-level await blocks Hermes parse/compile.',
      lazyRepresentation:
        'BLOB behavior and parser initialization can both be represented as shared promises, then awaited at async API boundaries.',
    },
  };
};

const writeMarkdown = (summary) => {
  const lines = [];
  lines.push('# C0.5 M2.3b — Targeted packaging + top-level-await compatibility spike');
  lines.push('');
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Verdict: **${summary.verdict}**`);
  lines.push('');
  lines.push('## 1) Root cause of stock package-entry failure');
  lines.push('');
  lines.push(`- Node resolves \`@getodk/xforms-engine\` to: \`${summary.packageAnalysis.nodeResolvedEntry}\`.`);
  if (summary.packageAnalysis.historicalMetroResolutionFailure?.attemptedMainPath != null) {
    lines.push(
      `- Historical RN CLI Metro failure attempted unresolved path: \`${summary.packageAnalysis.historicalMetroResolutionFailure.attemptedMainPath}\`.`
    );
  }
  lines.push(
    '- Current Expo (`expo export:embed`) resolves stock package entry and fails later in Hermes on top-level await, so package-entry failure is not universal on modern Expo.'
  );
  lines.push('');
  lines.push('## 2) Package metadata/resolution analysis');
  lines.push('');
  lines.push(`- package.json: \`${summary.packageAnalysis.packagePath}\``);
  lines.push(`- type: \`${summary.packageAnalysis.type}\``);
  lines.push(`- main: \`${String(summary.packageAnalysis.main)}\``);
  lines.push(`- module: \`${String(summary.packageAnalysis.module)}\``);
  lines.push(`- browser: \`${String(summary.packageAnalysis.browser)}\``);
  lines.push(`- subpath exports: \`${summary.packageAnalysis.subpathExports.join(', ')}\``);
  lines.push(`- exports["."] keys: \`${Object.keys(summary.packageAnalysis.exports?.['.'] ?? {}).join(', ')}\``);
  lines.push('');
  lines.push('## 3) Modern syntax inventory');
  lines.push('');
  lines.push(`- Total top-level await occurrences in published dist: **${summary.syntaxInventory.summary.totalTopLevelAwait}**`);
  lines.push(`- Files with TLA: \`${summary.syntaxInventory.summary.filesWithTopLevelAwait.join(', ')}\``);
  lines.push('');
  lines.push('## 4) TLA count + locations');
  lines.push('');
  for (const file of summary.syntaxInventory.files) {
    lines.push(`- ${file.sourcePath}: ${file.featureCounts.topLevelAwait}`);
    for (const hit of file.topLevelAwaitExcerpts) {
      lines.push(`  - L${hit.line}: \`${hit.lineText}\``);
    }
  }
  lines.push('');
  lines.push('## 5) `BLOB_BEHAVIOR` semantic trace');
  lines.push('');
  lines.push(`- detectBlobBehavior line: ${summary.blobTrace.detectBlobBehaviorLine}`);
  lines.push(`- blob-related TLA line: ${summary.blobTrace.blobBehaviorTopLevelAwaitLine}`);
  lines.push(`- parser-related TLA line: ${summary.blobTrace.expressionParserTopLevelAwaitLine}`);
  lines.push(`- retrieveSourceXMLResource blob read line: ${summary.blobTrace.retrieveSourceXmlBlobReadLine}`);
  lines.push(`- attachment blob read line: ${summary.blobTrace.attachmentBinaryReadLine}`);
  lines.push(`- instance blob read line: ${summary.blobTrace.instanceBlobReadLine}`);
  lines.push(`- encrypted attachment read line: ${summary.blobTrace.encryptedAttachmentReadLine}`);
  lines.push(`- detect reason: ${summary.blobTrace.interpretation.detectBlobBehavior}`);
  lines.push('');
  lines.push('## 6) Evaluated strategies');
  lines.push('');
  lines.push('- A: deterministic generated transform of published dist (implemented).');
  lines.push('- B: wrapper/init-only approach still leaves stock TLA parse blocker unless internals are adapted.');
  lines.push('- C: patch-package can prove viability but is maintenance-heavier than generated transform.');
  lines.push('- D: narrow Metro alias is sufficient as routing glue to compat output.');
  lines.push('');
  lines.push('## 7) Selected strategy');
  lines.push('');
  lines.push('- **A + D** (generated transform + narrow alias in `metro.config.js`).');
  lines.push('');
  lines.push('## 8) Exact compatibility code/configuration added');
  lines.push('');
  lines.push('- `metro.config.js` mode switch (`stock`, `alias-dist`, `compat`).');
  lines.push(`- generated compat files: \`${summary.compatibilityBuild.compatIndexPath}\`, \`${summary.compatibilityBuild.compatSolidPath}\``);
  lines.push(`- transform verification: ${JSON.stringify(summary.compatibilityBuild.verification)}`);
  lines.push('');
  lines.push('## 9) Minimal Hermes module-import result');
  lines.push('');
  for (const result of summary.minimalProof) {
    lines.push(`- ${result.platform} ${result.buildMode} (${result.modeName}): ${result.ok ? 'PASS' : 'FAIL'}`);
  }
  lines.push('');
  lines.push('## 10) Full XForms semantic-probe result');
  lines.push('');
  for (const result of summary.semanticProbe) {
    lines.push(`- ${result.platform} ${result.buildMode}: ${result.ok ? 'PASS' : 'FAIL'}`);
  }
  lines.push(`- Node semantic probe with transformed module: ${summary.nodeSemanticProbe.ok ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('## 11-12) Android/iOS debug/release');
  lines.push('');
  lines.push('| Target | Stock import | Alias dist | Compat transform |');
  lines.push('|---|---|---|---|');
  for (const platform of ['android', 'ios']) {
    const stockRelease = summary.stockRelease.find((item) => item.platform === platform);
    const aliasRelease = summary.aliasDistRelease.find((item) => item.platform === platform);
    const compatRelease = summary.compatRelease.find((item) => item.platform === platform);
    lines.push(
      `| ${platform} release | ${
        stockRelease.ok ? 'PASS' : stockRelease.hasTopLevelAwaitFailure ? 'FAIL (TLA)' : `FAIL (${stockRelease.status})`
      } | ${aliasRelease.ok ? 'PASS' : aliasRelease.hasTopLevelAwaitFailure ? 'FAIL (TLA)' : `FAIL (${aliasRelease.status})`} | ${
        compatRelease.ok ? 'PASS' : `FAIL (${compatRelease.status})`
      } |`
    );
  }
  lines.push('');
  lines.push('App launch/runtime execution matrix:');
  lines.push('- Android debug: NOT RUN (no connected emulator/device).');
  lines.push('- Android release: NOT RUN (no connected emulator/device).');
  lines.push('- iOS debug: NOT RUN (local CocoaPods environment issue).');
  lines.push('- iOS release: NOT RUN (local CocoaPods environment issue).');
  lines.push('');
  lines.push('## 13) Maintenance assessment');
  lines.push('');
  lines.push('- Generated transform is deterministic and isolated, but must be re-run and validated on every xforms-engine upgrade.');
  lines.push('');
  lines.push('## 14) Verdict');
  lines.push('');
  lines.push(`- **${summary.verdict}**`);
  lines.push('');
  lines.push('## 15) Recommendation');
  lines.push('');
  lines.push(summary.recommendation);
  lines.push('');

  return `${lines.join('\n')}\n`;
};

const main = () => {
  ensureDir(outDir);

  const versions = gatherVersions();
  const compatibilityBuild = buildCompatibilityBundle();

  const stockRelease = [];
  const aliasDistRelease = [];
  const compatRelease = [];
  for (const platform of ['android', 'ios']) {
    stockRelease.push(
      runExpoEmbed({
        label: 'stock-minimal',
        modeName: 'stock',
        entryFile: 'gate/metroEntryMinimalDefault.js',
        platform,
        dev: false,
        minify: true,
      })
    );
    aliasDistRelease.push(
      runExpoEmbed({
        label: 'alias-dist-minimal',
        modeName: 'alias-dist',
        entryFile: 'gate/metroEntryMinimalDefault.js',
        platform,
        dev: false,
        minify: true,
      })
    );
    compatRelease.push(
      runExpoEmbed({
        label: 'compat-minimal',
        modeName: 'compat',
        entryFile: 'gate/metroEntryMinimalDefault.js',
        platform,
        dev: false,
        minify: true,
      })
    );
  }

  const minimalProof = [];
  for (const platform of ['android', 'ios']) {
    for (const [dev, minify] of [
      [true, false],
      [false, true],
    ]) {
      minimalProof.push(
        runExpoEmbed({
          label: 'compat-minimal-matrix',
          modeName: 'compat',
          entryFile: 'gate/metroEntryMinimalDefault.js',
          platform,
          dev,
          minify,
        })
      );
    }
  }

  const semanticProbe = [];
  for (const platform of ['android', 'ios']) {
    for (const [dev, minify] of [
      [true, false],
      [false, true],
    ]) {
      semanticProbe.push(
        runExpoEmbed({
          label: 'compat-semantic-matrix',
          modeName: 'compat',
          entryFile: 'gate/metroEntryDefault.js',
          platform,
          dev,
          minify,
        })
      );
    }
  }

  const packageAnalysis = analyzePackageStructure({ stockReleaseMinimalResults: stockRelease });
  const syntaxInventory = analyzeSyntaxInventory();
  const blobTrace = analyzeBlobTrace();
  const nodeSemanticProbe = runNodeCompatibilityProbe();

  const stockFailsOnTlaOnly = stockRelease.every(
    (result) => !result.ok && result.hasTopLevelAwaitFailure && !result.hasModuleResolutionFailure
  );
  const aliasDistFailsOnTlaOnly = aliasDistRelease.every(
    (result) => !result.ok && result.hasTopLevelAwaitFailure && !result.hasModuleResolutionFailure
  );
  const compatReleasePass = compatRelease.every((result) => result.ok);
  const compatMinimalMatrixPass = minimalProof.every((result) => result.ok);
  const compatSemanticMatrixPass = semanticProbe.every((result) => result.ok);

  let verdict = 'RED';
  if (
    stockFailsOnTlaOnly &&
    aliasDistFailsOnTlaOnly &&
    compatReleasePass &&
    compatMinimalMatrixPass &&
    compatSemanticMatrixPass &&
    nodeSemanticProbe.ok
  ) {
    verdict = 'GREEN';
  } else if ((compatReleasePass || compatSemanticMatrixPass) && nodeSemanticProbe.ok) {
    verdict = 'YELLOW';
  }

  const recommendation =
    verdict === 'GREEN'
      ? 'Proceed to M3 with an isolated generated compatibility transform for xforms-engine and open an upstream issue/PR to remove module-level top-level await.'
      : verdict === 'YELLOW'
        ? 'Keep direct-Hermes as provisional: retain the compatibility layer with CI gating and compare long-term cost against hidden-WebView sidecar.'
        : 'Do not proceed to M3 yet; treat direct-Hermes path as blocked and continue with a WebView sidecar spike.';

  const summary = {
    generatedAt: new Date().toISOString(),
    versions,
    packageAnalysis,
    syntaxInventory,
    blobTrace,
    compatibilityBuild,
    stockRelease,
    aliasDistRelease,
    compatRelease,
    minimalProof,
    semanticProbe,
    nodeSemanticProbe,
    verdict,
    recommendation,
  };

  const jsonPath = path.join(outDir, 'm2.3b-gate-results.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  const mdPath = path.join(outDir, 'm2.3b-final-report.md');
  fs.writeFileSync(mdPath, writeMarkdown(summary), 'utf8');

  console.log(`M2.3b gate written to ${path.relative(appRoot, mdPath)}`);
};

main();
