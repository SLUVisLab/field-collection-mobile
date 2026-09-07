/**
 * The runner for Gather's browser-level tests.
 *
 * Unit tests stay on `node --test`: they need no browser, and most of what the
 * old gates asserted turned out to be provable there. What is left needs a real
 * browser for a real reason — ONNX Runtime Web executing real model bytes, the
 * pinned upstream Composer running our patch, the postMessage bridge between
 * two origins — and that is what these tiers are for.
 *
 * See docs/planning/testing-strategy-foundation.md, and the same structure in
 * openfieldworks-web's apps/wrapper.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test',
  testMatch: '**/*.test.mjs',
  // Everything else under test/ is node:test and would fail under this runner.
  testIgnore: ['a2ui/**', 'app/**', 'authoring/**', 'capabilities/**', 'compute/**',
    'entities/**', 'fieldwork/**', 'forms/**', 'instances/**', 'live/**', 'media/**',
    'packaging/**', 'provenance/**', 'provisioning/**', 'renderer/**', 'shell/**',
    'sync/**', 'theme/**', 'xforms/**'],

  // These drive the one deployed renderer and editor, so they cannot run in
  // parallel against each other.
  workers: 1,
  fullyParallel: false,

  // A test that fails intermittently should be fixed, not re-run until green.
  retries: 0,

  reporter: [['list']],

  use: {
    // The deployment already runs the installed Chrome; nothing is downloaded.
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  timeout: 120000,
  expect: { timeout: 20000 },
});
