#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(__dirname, 'out');
const resultPrefix = 'M2_XFORMS_ENV_RESULT::';

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const trimOutput = (text, max = 12000) => {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]`;
};

const runEnvironment = (env) => {
  const installJsdomPath = path.join(__dirname, 'installJsdomCompatibility.js');
  const installSlimdomPath = path.join(__dirname, 'installDomCompatibility.js');
  const scenarioPath = path.join(__dirname, 'xformsScenario.js');

  const inlineScript = `
    (async () => {
      const envName = process.argv[1];
      const prefix = ${JSON.stringify(resultPrefix)};
      const { installJsdomDomCompatibility } = require(${JSON.stringify(installJsdomPath)});
      const { installSlimdomDomCompatibility } = require(${JSON.stringify(installSlimdomPath)});
      const { runXformsScenario } = require(${JSON.stringify(scenarioPath)});
      let restoreEnvironment = null;
      try {
        restoreEnvironment = envName === 'jsdom'
          ? installJsdomDomCompatibility({ force: true })
          : installSlimdomDomCompatibility({ force: true });
        const xformsEngine = await import('@getodk/xforms-engine');
        const scenarioResult = await runXformsScenario({ loadForm: xformsEngine.loadForm });
        console.log(prefix + JSON.stringify({ env: envName, scenarioResult }));
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error(String(error));
        console.log(prefix + JSON.stringify({
          env: envName,
          fatalError: {
            name: resolvedError.name,
            message: resolvedError.message,
            stack: resolvedError.stack,
          }
        }));
        process.exitCode = 1;
      } finally {
        restoreEnvironment?.restore();
      }
    })();
  `;

  const result = spawnSync('node', ['-e', inlineScript, env], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 50 * 1024 * 1024,
  });

  const combined = `${result.stdout}\n${result.stderr}`;
  const payloadLine = combined
    .split('\n')
    .find((line) => line.includes(resultPrefix));

  let payload = null;
  if (payloadLine != null) {
    const jsonText = payloadLine.slice(payloadLine.indexOf(resultPrefix) + resultPrefix.length).trim();
    try {
      payload = JSON.parse(jsonText);
    } catch {
      payload = null;
    }
  }

  return {
    env,
    status: result.status ?? 1,
    stdout: trimOutput(result.stdout),
    stderr: trimOutput(result.stderr),
    payload,
  };
};

const compareScenarios = (reference, candidate) => {
  const differences = [];

  const compare = (pathLabel, left, right) => {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      differences.push({
        path: pathLabel,
        reference: left,
        candidate: right,
      });
    }
  };

  compare('loadStatus', reference.loadStatus, candidate.loadStatus);
  compare('snapshots.initial', reference.snapshots?.initial, candidate.snapshots?.initial);
  compare(
    'snapshots.afterPrimaryUpdates',
    reference.snapshots?.afterPrimaryUpdates,
    candidate.snapshots?.afterPrimaryUpdates
  );
  compare(
    'snapshots.afterConstraintChange',
    reference.snapshots?.afterConstraintChange,
    candidate.snapshots?.afterConstraintChange
  );
  compare(
    'snapshots.afterRepeatMutation',
    reference.snapshots?.afterRepeatMutation,
    candidate.snapshots?.afterRepeatMutation
  );
  compare('payload.status', reference.payload?.status, candidate.payload?.status);
  compare('payload.violationCount', reference.payload?.violationCount, candidate.payload?.violationCount);
  compare(
    'payload.normalizedInstanceXml',
    reference.payload?.normalizedInstanceXml,
    candidate.payload?.normalizedInstanceXml
  );

  return {
    equivalent: differences.length === 0,
    differences,
  };
};

const writeMarkdown = (summary) => {
  const lines = [];
  lines.push('# M2.2 Node semantic equivalence');
  lines.push('');
  lines.push(`- Generated: ${summary.generatedAt}`);
  lines.push(`- Verdict: **${summary.verdict}**`);
  lines.push(`- Equivalent scenario output: **${summary.comparison.equivalent ? 'yes' : 'no'}**`);
  lines.push('');
  lines.push('## Environment execution');
  lines.push('');
  lines.push('| Environment | Process status | Load status | Fatal error |');
  lines.push('|---|---|---|---|');
  for (const run of summary.runs) {
    lines.push(
      `| ${run.env} | ${run.status} | ${run.payload?.scenarioResult?.loadStatus ?? 'n/a'} | ${
        run.payload?.fatalError?.message ?? 'none'
      } |`
    );
  }
  lines.push('');
  lines.push('## Compared semantics');
  lines.push('');
  lines.push('- Form load/init');
  lines.push('- Initial state snapshot');
  lines.push('- setValue / calculate / relevant / constraint transitions');
  lines.push('- select/itemset value options + value selection');
  lines.push('- repeat add/remove behavior');
  lines.push('- serialized instance payload (normalized instanceID)');
  lines.push('');

  if (summary.comparison.differences.length > 0) {
    lines.push('## Differences');
    lines.push('');
    for (const difference of summary.comparison.differences) {
      lines.push(`- ${difference.path}`);
      lines.push(`  - jsdom: \`${JSON.stringify(difference.reference)}\``);
      lines.push(`  - slimdom+adapter: \`${JSON.stringify(difference.candidate)}\``);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const main = () => {
  ensureDir(outDir);

  const runs = [runEnvironment('jsdom'), runEnvironment('slimdom')];
  const jsdomRun = runs.find((run) => run.env === 'jsdom');
  const slimdomRun = runs.find((run) => run.env === 'slimdom');

  let verdict = 'RED';
  let comparison = { equivalent: false, differences: [] };

  if (
    jsdomRun?.status === 0 &&
    slimdomRun?.status === 0 &&
    jsdomRun.payload?.scenarioResult != null &&
    slimdomRun.payload?.scenarioResult != null
  ) {
    comparison = compareScenarios(jsdomRun.payload.scenarioResult, slimdomRun.payload.scenarioResult);
    verdict = comparison.equivalent ? 'GREEN' : 'RED';
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    runs,
    comparison,
    verdict,
  };

  const jsonPath = path.join(outDir, 'm2.2-node-equivalence.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const mdPath = path.join(outDir, 'm2.2-node-equivalence.md');
  fs.writeFileSync(mdPath, writeMarkdown(summary), 'utf8');

  if (summary.verdict !== 'GREEN') {
    console.error(`Node equivalence failed; see ${path.relative(repoRoot, mdPath)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Node equivalence passed; see ${path.relative(repoRoot, mdPath)}`);
};

main();
