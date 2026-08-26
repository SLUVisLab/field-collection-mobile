import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseFormList,
  parseOpenRosaResponse,
  buildSubmissionParts,
} from '../src/openrosa.js';
import { ODK_CENTRAL_ERROR_CODES } from '../src/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const readFixture = (name) => readFile(join(here, 'fixtures', name), 'utf-8');

test('parseFormList extracts each xform entry', async () => {
  const xml = await readFixture('formList.xml');
  const forms = parseFormList(xml);
  assert.equal(forms.length, 2);
  assert.deepEqual(forms[0], {
    formId: 'm2_4_fixture',
    name: 'M2.4 Fixture',
    version: '2024010100',
    hash: 'md5:abc123def456',
    downloadUrl: 'https://central.example.org/v1/projects/1/forms/m2_4_fixture.xml',
    manifestUrl: null,
  });
  assert.equal(forms[1].formId, 'with_media');
  assert.equal(
    forms[1].manifestUrl,
    'https://central.example.org/v1/projects/1/forms/with_media/manifest'
  );
});

test('parseFormList rejects empty input', () => {
  assert.throws(() => parseFormList(''), (e) => e.code === ODK_CENTRAL_ERROR_CODES.PARSE);
});

test('parseOpenRosaResponse extracts the message', async () => {
  const xml = await readFixture('submission-response.xml');
  assert.equal(parseOpenRosaResponse(xml).message, 'full submission upload was successful!');
  assert.equal(parseOpenRosaResponse('').message, null);
});

test('buildSubmissionParts always includes xml_submission_file first', () => {
  const parts = buildSubmissionParts({ xml: '<data/>' });
  assert.equal(parts.length, 1);
  assert.equal(parts[0].name, 'xml_submission_file');
  assert.equal(parts[0].contentType, 'text/xml');
  assert.equal(parts[0].body, '<data/>');
});

test('buildSubmissionParts adds a part per attachment (inline data or uri reference)', () => {
  const parts = buildSubmissionParts({
    xml: '<data/>',
    attachments: [
      { name: 'photo.jpg', contentType: 'image/jpeg', data: 'BYTES' },
      { name: 'audio.m4a', uri: 'file:///tmp/audio.m4a' },
    ],
  });
  assert.equal(parts.length, 3);
  assert.equal(parts[1].name, 'photo.jpg');
  assert.equal(parts[1].body, 'BYTES');
  assert.equal(parts[2].name, 'audio.m4a');
  assert.equal(parts[2].contentType, 'application/octet-stream');
  assert.deepEqual(parts[2].body, {
    uri: 'file:///tmp/audio.m4a',
    name: 'audio.m4a',
    type: undefined,
  });
});

test('buildSubmissionParts validates xml and attachment shape', () => {
  assert.throws(
    () => buildSubmissionParts({ xml: '' }),
    (e) => e.code === ODK_CENTRAL_ERROR_CODES.BAD_REQUEST
  );
  assert.throws(
    () => buildSubmissionParts({ xml: '<d/>', attachments: [{ contentType: 'image/png' }] }),
    (e) => e.code === ODK_CENTRAL_ERROR_CODES.BAD_REQUEST
  );
  assert.throws(
    () => buildSubmissionParts({ xml: '<d/>', attachments: [{ name: 'x.png' }] }),
    (e) => e.code === ODK_CENTRAL_ERROR_CODES.BAD_REQUEST
  );
});
