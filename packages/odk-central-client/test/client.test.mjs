import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { OdkCentralClient } from '../src/OdkCentralClient.js';
import { createAppUserAuth, createSessionAuth } from '../src/auth.js';
import { ODK_CENTRAL_ERROR_CODES } from '../src/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const readFixture = (name) => readFile(join(here, 'fixtures', name), 'utf-8');

/**
 * Builds a mock `fetch` that records every call and dispatches to a router.
 * The router matches on a substring of the URL and returns a `Response`.
 */
const createMockFetch = (routes) => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    for (const route of routes) {
      if (url.includes(route.match) && (route.method == null || route.method === options.method)) {
        return typeof route.respond === 'function'
          ? route.respond({ url, options })
          : route.respond;
      }
    }
    throw new Error(`No mock route for ${options.method} ${url}`);
  };
  return { fetchImpl, calls };
};

const BASE = 'https://central.example.org';

test('listForms sends OpenRosa header and parses the form list', async () => {
  const formListXml = await readFixture('formList.xml');
  const { fetchImpl, calls } = createMockFetch([
    {
      match: '/formList',
      method: 'GET',
      respond: () => new Response(formListXml, { status: 200, headers: { 'X-OpenRosa-Version': '1.0' } }),
    },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const forms = await client.listForms();
  assert.equal(forms.length, 2);
  assert.equal(forms[0].formId, 'm2_4_fixture');
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/formList`);
  assert.equal(calls[0].options.headers['X-OpenRosa-Version'], '1.0');
});

test('downloadForm requests the .xml route and returns the body', async () => {
  const { fetchImpl, calls } = createMockFetch([
    { match: '.xml', method: 'GET', respond: () => new Response('<h:html>form</h:html>', { status: 200 }) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const xml = await client.downloadForm({ formId: 'm2_4_fixture' });
  assert.equal(xml, '<h:html>form</h:html>');
  assert.equal(calls[0].url, `${BASE}/v1/projects/1/forms/m2_4_fixture.xml`);
  assert.equal(calls[0].options.headers.Accept, 'application/xml');
});

test('downloadForm maps a 404 to a NOT_FOUND OdkCentralError', async () => {
  const { fetchImpl } = createMockFetch([
    {
      match: '.xml',
      respond: () => new Response(JSON.stringify({ message: 'Could not find the resource.' }), { status: 404 }),
    },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  await assert.rejects(
    client.downloadForm({ formId: 'missing' }),
    (error) => {
      assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.NOT_FOUND);
      assert.equal(error.httpStatus, 404);
      return true;
    }
  );
});

test('submit posts a multipart body with xml_submission_file to the submission route', async () => {
  const responseXml = await readFixture('submission-response.xml');
  const { fetchImpl, calls } = createMockFetch([
    { match: '/submission', method: 'POST', respond: () => new Response(responseXml, { status: 201 }) },
  ]);
  const client = new OdkCentralClient({ baseUrl: BASE, projectId: 1, fetch: fetchImpl });

  const result = await client.submit({
    xml: '<data id="m2_4_fixture"><age>17</age></data>',
    attachments: [{ name: 'photo.jpg', contentType: 'image/jpeg', data: 'BYTES' }],
  });

  assert.equal(result.status, 201);
  assert.equal(result.message, 'full submission upload was successful!');

  const call = calls[0];
  assert.equal(call.url, `${BASE}/v1/projects/1/submission`);
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers['X-OpenRosa-Version'], '1.0');

  const body = call.options.body;
  assert.ok(body instanceof FormData);
  const xmlPart = body.get('xml_submission_file');
  assert.ok(xmlPart != null);
  assert.match(await xmlPart.text(), /<age>17<\/age>/);
  assert.ok(body.get('photo.jpg') != null);
});

test('session auth performs a single login and reuses the bearer token', async () => {
  const formListXml = await readFixture('formList.xml');
  const { fetchImpl, calls } = createMockFetch([
    {
      match: '/v1/sessions',
      method: 'POST',
      respond: () =>
        new Response(JSON.stringify({ token: 'SESSION123', createdAt: 'x', expiresAt: 'y' }), {
          status: 200,
        }),
    },
    {
      match: '/formList',
      method: 'GET',
      respond: () => new Response(formListXml, { status: 200 }),
    },
  ]);
  const client = new OdkCentralClient({
    baseUrl: BASE,
    projectId: 1,
    auth: createSessionAuth({ email: 'a@b.co', password: 'pw' }),
    fetch: fetchImpl,
  });

  await client.listForms();
  await client.listForms();

  const loginCalls = calls.filter((c) => c.url.includes('/v1/sessions'));
  const listCalls = calls.filter((c) => c.url.includes('/formList'));
  assert.equal(loginCalls.length, 1, 'logs in exactly once');
  assert.equal(listCalls.length, 2);
  assert.equal(listCalls[0].options.headers.Authorization, 'Bearer SESSION123');
});

test('app user auth actuates the /key/<token> route prefix', async () => {
  const formListXml = await readFixture('formList.xml');
  const { fetchImpl, calls } = createMockFetch([
    { match: '/formList', method: 'GET', respond: () => new Response(formListXml, { status: 200 }) },
  ]);
  const client = new OdkCentralClient({
    baseUrl: BASE,
    projectId: 1,
    auth: createAppUserAuth('APPTOKEN'),
    fetch: fetchImpl,
  });

  await client.listForms();
  assert.equal(calls[0].url, `${BASE}/v1/key/APPTOKEN/projects/1/formList`);
});
