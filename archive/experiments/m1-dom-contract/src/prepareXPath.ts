import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureDir, outDir, vendorDir, writeJson } from './utils.js';

const ODK_CENTRAL_FRONTEND_URL = 'https://github.com/getodk/central-frontend.git';
const requestedRef = process.env.ODK_CF_REF?.trim() ?? '';

const centralRepoDir = path.join(vendorDir, 'central-frontend');
const vendoredXPathDir = path.join(vendorDir, 'xpath');
const sourceXPathDir = path.join(centralRepoDir, 'packages', 'xpath');
const requestedRefLabel = requestedRef.length > 0 ? requestedRef : '(default branch)';

interface XPathSourceMetadata {
  mode: 'vendored-source' | 'bundled-dist-only';
  generatedAt: string;
  requestedRef: string;
  commit?: string;
  reason?: string;
}

const runGit = (args: string[], cwd?: string): string => {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const command = `git ${args.join(' ')}`;
    const stderr = result.stderr.trim();
    throw new Error(`${command} failed${stderr.length > 0 ? `: ${stderr}` : ''}`);
  }

  return result.stdout.trim();
};

const writeMetadata = (metadata: XPathSourceMetadata): void => {
  writeJson(path.join(outDir, 'xpath-source.json'), metadata);
};

const copyXPathSource = (): void => {
  fs.rmSync(vendoredXPathDir, { recursive: true, force: true });
  fs.cpSync(sourceXPathDir, vendoredXPathDir, { recursive: true });
};

const ensureCentralRepo = (): void => {
  if (fs.existsSync(centralRepoDir)) {
    return;
  }

  runGit(['clone', '--filter=blob:none', '--depth=1', ODK_CENTRAL_FRONTEND_URL, centralRepoDir]);
};

const checkoutRequestedRef = (): void => {
  if (requestedRef.length === 0) {
    return;
  }

  const fetch = spawnSync('git', ['fetch', '--depth=1', 'origin', requestedRef], {
    cwd: centralRepoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (fetch.status !== 0) {
    const detail = fetch.stderr.trim() || fetch.stdout.trim();
    console.warn(
      `Requested ref "${requestedRef}" was not found on origin; using cloned default branch instead (${detail})`
    );
    return;
  }

  runGit(['checkout', '--detach', 'FETCH_HEAD'], centralRepoDir);
};

const main = (): void => {
  ensureDir(vendorDir);
  ensureDir(outDir);

  try {
    ensureCentralRepo();
    checkoutRequestedRef();

    if (!fs.existsSync(sourceXPathDir)) {
      throw new Error(`Expected xpath source at ${sourceXPathDir}`);
    }

    copyXPathSource();
    const commit = runGit(['rev-parse', 'HEAD'], centralRepoDir);

    writeMetadata({
      mode: 'vendored-source',
      generatedAt: new Date().toISOString(),
      requestedRef: requestedRefLabel,
      commit,
    });

    console.log(`Vendored xpath source from ${requestedRefLabel} (${commit.slice(0, 12)})`);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeMetadata({
      mode: 'bundled-dist-only',
      generatedAt: new Date().toISOString(),
      requestedRef: requestedRefLabel,
      reason: message,
    });

    console.error(
      `Could not vendor central-frontend xpath source, falling back to bundled engine dist: ${message}`
    );
  }
};

main();
