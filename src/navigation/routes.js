/**
 * Route metadata for the Gather shell — PURE data + helpers (no React / React
 * Native imports), so it is fully unit-testable in Node and shared by both the
 * navigator and the Android navigation gate.
 *
 * The shell has two mutually-exclusive route trees chosen at bootstrap:
 *   - the SETUP shell, shown when there is no active project (connect / scan);
 *   - the PROJECT shell, shown when a project is active (forms, drafts, switch).
 *
 * Each tree has exactly one ROOT route. Hardware-back on a root route exits the
 * app; on any deeper route it pops one level (see backBehavior.js).
 */

/** Canonical path constants. Import these instead of hard-coding strings. */
export const ROUTES = Object.freeze({
  setup: {
    home: '/setup',
    connect: '/setup/connect',
    scan: '/setup/scan',
  },
  project: {
    home: '/project',
    forms: '/project/forms',
    form: '/project/forms/:formId',
    drafts: '/project/drafts',
    instance: '/project/drafts/:instanceId',
    resume: '/project/drafts/:instanceId/fill',
    switch: '/project/switch',
    fieldwork: '/project/fieldwork',
    fieldworkSession: '/project/fieldwork/:sessionId',
    segmentMeasure: '/project/segment-measure',
  },
});

/** The one root route of each shell (hardware-back here exits the app). */
export const ROOT_PATHS = Object.freeze({
  setup: ROUTES.setup.home,
  project: ROUTES.project.home,
});

/**
 * Declarative screen registry per shell. Each entry drives both the router
 * (`path` → `screen` id) and the gate (`visit` = a concrete path to navigate to,
 * with params filled in). `index` marks the root/index route of the shell.
 */
export const SHELL_SCREENS = Object.freeze({
  setup: [
    { id: 'setup-home', path: ROUTES.setup.home, visit: ROUTES.setup.home, index: true },
    { id: 'setup-connect', path: ROUTES.setup.connect, visit: ROUTES.setup.connect },
    { id: 'setup-scan', path: ROUTES.setup.scan, visit: ROUTES.setup.scan },
  ],
  project: [
    { id: 'project-home', path: ROUTES.project.home, visit: ROUTES.project.home, index: true },
    { id: 'project-forms', path: ROUTES.project.forms, visit: ROUTES.project.forms },
    { id: 'project-form', path: ROUTES.project.form, visit: '/project/forms/demo-form' },
    { id: 'project-drafts', path: ROUTES.project.drafts, visit: ROUTES.project.drafts },
    { id: 'project-instance', path: ROUTES.project.instance, visit: '/project/drafts/demo-instance' },
    { id: 'project-switch', path: ROUTES.project.switch, visit: ROUTES.project.switch },
  ],
});

/** Which shell to render given the active project (null → setup). */
export const shellForActiveProject = (activeProject) =>
  activeProject ? 'project' : 'setup';

/** The initial entry path for a shell, used to seed the in-memory router. */
export const initialEntryForShell = (shell) => ROOT_PATHS[shell] ?? ROOT_PATHS.setup;

/** The ordered list of concrete paths the gate walks for a shell. */
export const visitOrderForShell = (shell) =>
  (SHELL_SCREENS[shell] ?? []).map((screen) => screen.visit);

/** True when `pathname` is the root/index route of its shell. */
export const isRootPath = (pathname) =>
  Object.values(ROOT_PATHS).includes(pathname);
