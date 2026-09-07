import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUTES,
  ROOT_PATHS,
  SHELL_SCREENS,
  shellForActiveProject,
  initialEntryForShell,
  visitOrderForShell,
  isRootPath,
} from '../../src/navigation/routes.js';

test('each shell has exactly one index/root route matching ROOT_PATHS', () => {
  for (const shell of ['setup', 'project']) {
    const indexScreens = SHELL_SCREENS[shell].filter((s) => s.index);
    assert.equal(indexScreens.length, 1, `${shell} has one index route`);
    assert.equal(indexScreens[0].path, ROOT_PATHS[shell]);
  }
});

test('shellForActiveProject picks setup when no project is active', () => {
  assert.equal(shellForActiveProject(null), 'setup');
  assert.equal(shellForActiveProject(undefined), 'setup');
  assert.equal(shellForActiveProject({ projectKey: 'p' }), 'project');
});

test('initialEntryForShell returns the shell root, defaulting to setup', () => {
  assert.equal(initialEntryForShell('setup'), ROUTES.setup.home);
  assert.equal(initialEntryForShell('project'), ROUTES.project.home);
  assert.equal(initialEntryForShell('bogus'), ROUTES.setup.home);
});

test('isRootPath is true only for the two shell roots', () => {
  assert.equal(isRootPath('/setup'), true);
  assert.equal(isRootPath('/project'), true);
  assert.equal(isRootPath('/project/forms'), false);
  assert.equal(isRootPath('/setup/connect'), false);
  assert.equal(isRootPath('/nope'), false);
});

test('visitOrderForShell yields concrete (param-free) paths for every screen', () => {
  const projectVisits = visitOrderForShell('project');
  assert.equal(projectVisits.length, SHELL_SCREENS.project.length);
  // No unresolved ":param" tokens remain in the concrete visit paths.
  for (const path of projectVisits) {
    assert.doesNotMatch(path, /:/, `visit path ${path} has no param placeholder`);
  }
  assert.deepEqual(visitOrderForShell('unknown'), []);
});

test('all core M5 screens are represented across the two shells', () => {
  const ids = [
    ...SHELL_SCREENS.setup.map((s) => s.id),
    ...SHELL_SCREENS.project.map((s) => s.id),
  ];
  for (const required of [
    'setup-home',
    'setup-connect',
    'setup-scan',
    'project-home',
    'project-forms',
    'project-form',
    'project-drafts',
    'project-instance',
    'project-switch',
  ]) {
    assert.ok(ids.includes(required), `missing screen: ${required}`);
  }
});
