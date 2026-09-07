import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GatherPaths,
  GatherPathError,
  assertProjectKey,
  assertRelativeKey,
  joinKey,
  keyToSegments,
  PROJECT_SUBDIRECTORIES,
} from '../src/paths.js';

test('GatherPaths builds deterministic project-scoped keys', () => {
  assert.equal(GatherPaths.project('abc'), 'projects/abc');
  assert.equal(GatherPaths.forms('abc', 'silphium', 'form.xml'), 'projects/abc/forms/silphium/form.xml');
  assert.equal(GatherPaths.media('abc', 'photo.jpg'), 'projects/abc/media/photo.jpg');
  assert.equal(GatherPaths.instances('abc', 'i1', 'submission.xml'), 'projects/abc/instances/i1/submission.xml');
  assert.equal(GatherPaths.models('abc', 'm.onnx'), 'projects/abc/models/m.onnx');
  // Same inputs always produce the same key.
  assert.equal(GatherPaths.forms('abc', 'x'), GatherPaths.forms('abc', 'x'));
});

test('project keys are isolated: same sub-path differs only by project prefix', () => {
  const a = GatherPaths.forms('projA', 'shared', 'form.xml');
  const b = GatherPaths.forms('projB', 'shared', 'form.xml');
  assert.notEqual(a, b);
  assert.equal(a, 'projects/projA/forms/shared/form.xml');
  assert.equal(b, 'projects/projB/forms/shared/form.xml');
  // One project's key never nests inside another's directory.
  assert.ok(!a.startsWith('projects/projB/'));
  assert.ok(!b.startsWith('projects/projA/'));
});

test('projectDirectories returns the standard subdirectory keys', () => {
  const dirs = GatherPaths.projectDirectories('abc');
  assert.deepEqual(
    dirs,
    PROJECT_SUBDIRECTORIES.map((sub) => `projects/abc/${sub}`)
  );
});

test('assertProjectKey rejects traversal and invalid characters', () => {
  for (const bad of ['..', '.', '', 'a/b', 'a b', '../x', '.hidden', 'a\u0000b', 'a\\b']) {
    assert.throws(() => assertProjectKey(bad), GatherPathError, `should reject ${JSON.stringify(bad)}`);
  }
  for (const good of ['abc', 'proj-1', 'proj_2', 'a.b', '1', 'A1b2_-.x']) {
    assert.equal(assertProjectKey(good), good);
  }
});

test('path segments reject traversal, separators and empties', () => {
  assert.throws(() => joinKey('a', '..', 'b'), GatherPathError);
  assert.throws(() => joinKey('a', '.', 'b'), GatherPathError);
  assert.throws(() => joinKey('a', 'b/c'), GatherPathError);
  assert.throws(() => joinKey('a', ''), GatherPathError);
  assert.throws(() => joinKey('a', '   '), GatherPathError);
  assert.throws(() => joinKey(), GatherPathError);
  assert.equal(joinKey('a', 'b', 'c'), 'a/b/c');
});

test('GatherPaths propagates project-key validation (path traversal in projectKey)', () => {
  assert.throws(() => GatherPaths.forms('..', 'x'), GatherPathError);
  assert.throws(() => GatherPaths.media('a/b', 'x'), GatherPathError);
  // Traversal attempts in trailing segments are rejected too.
  assert.throws(() => GatherPaths.forms('abc', '..', 'escape'), GatherPathError);
});

test('assertRelativeKey rejects absolute paths, URIs and traversal but accepts valid keys', () => {
  for (const bad of [
    '/abs/path',
    'file:///var/x',
    'https://example.org/x',
    'projects/../etc',
    'projects//double',
    '',
    'a/./b',
  ]) {
    assert.throws(() => assertRelativeKey(bad), GatherPathError, `should reject ${JSON.stringify(bad)}`);
  }
  assert.equal(assertRelativeKey('projects/abc/forms/x.xml'), 'projects/abc/forms/x.xml');
});

test('keyToSegments splits a validated key into segments', () => {
  assert.deepEqual(keyToSegments('projects/abc/forms/x.xml'), ['projects', 'abc', 'forms', 'x.xml']);
  assert.throws(() => keyToSegments('../escape'), GatherPathError);
});
