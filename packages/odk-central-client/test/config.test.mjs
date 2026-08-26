import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, createEndpoints } from '../src/config.js';
import { ODK_CENTRAL_ERROR_CODES } from '../src/errors.js';

test('normalizeConfig strips trailing slashes and keeps projectId/auth', () => {
  const config = normalizeConfig({ baseUrl: 'https://central.example.org///', projectId: 7 });
  assert.equal(config.baseUrl, 'https://central.example.org');
  assert.equal(config.projectId, 7);
  assert.equal(config.auth, null);
});

test('normalizeConfig rejects missing or non-http baseUrl', () => {
  assert.throws(() => normalizeConfig({}), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
  assert.throws(
    () => normalizeConfig({ baseUrl: 'central.example.org' }),
    (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG
  );
});

test('createEndpoints builds documented Central routes', () => {
  const endpoints = createEndpoints(normalizeConfig({ baseUrl: 'https://c.example.org', projectId: 1 }));
  assert.equal(endpoints.sessions(), 'https://c.example.org/v1/sessions');
  assert.equal(endpoints.serverVersion(), 'https://c.example.org/version.txt');
  assert.equal(endpoints.formList(), 'https://c.example.org/v1/projects/1/formList');
  assert.equal(endpoints.formXml(1, 'my form'), 'https://c.example.org/v1/projects/1/forms/my%20form.xml');
  assert.equal(
    endpoints.formAttachments(1, 'f'),
    'https://c.example.org/v1/projects/1/forms/f/attachments'
  );
  assert.equal(
    endpoints.formAttachment(1, 'f', 'a b.jpg'),
    'https://c.example.org/v1/projects/1/forms/f/attachments/a%20b.jpg'
  );
  assert.equal(endpoints.submission(), 'https://c.example.org/v1/projects/1/submission');
});

test('endpoints allow per-call projectId override and require one', () => {
  const endpoints = createEndpoints(normalizeConfig({ baseUrl: 'https://c.example.org' }));
  assert.equal(endpoints.formList(9), 'https://c.example.org/v1/projects/9/formList');
  assert.throws(() => endpoints.formList(), (e) => e.code === ODK_CENTRAL_ERROR_CODES.CONFIG);
});
