import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseFormList,
  parseManifest,
  parseOpenRosaResponse,
  buildSubmissionParts,
  toFormData,
  extractInstanceId,
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

test('parseManifest returns [] for an empty manifest (live-captured empty shape)', async () => {
  const xml = await readFixture('manifest.empty.xml');
  assert.deepEqual(parseManifest(xml), []);
});

test('parseManifest parses a populated manifest (live-captured Silphium shape)', async () => {
  const xml = await readFixture('manifest.populated.xml');
  const entries = parseManifest(xml);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    filename: 'silphium-reference.jpg',
    hash: 'md5:8112cfe204c4670b26d0e3756443a775',
    downloadUrl:
      'https://central.example.org/v1/key/<APP_TOKEN>/projects/1/forms/silphium_flower_survey/attachments/silphium-reference.jpg',
    type: null,
    integrityUrl: null,
    isEntityList: false,
  });
});

test('parseManifest handles multiple mediaFiles and missing fields tolerantly', () => {
  const xml = `<?xml version="1.0"?>
    <manifest xmlns="http://openrosa.org/xforms/xformsManifest">
      <mediaFile><filename>a.csv</filename><hash>md5:aaa</hash><downloadUrl>https://x/a.csv</downloadUrl></mediaFile>
      <mediaFile><filename>b.jpg</filename></mediaFile>
    </manifest>`;
  const entries = parseManifest(xml);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].filename, 'a.csv');
  assert.deepEqual(entries[1], {
    filename: 'b.jpg',
    hash: null,
    downloadUrl: null,
    type: null,
    integrityUrl: null,
    isEntityList: false,
  });
});

test('parseManifest distinguishes an entityList mediaFile from static media (live Silphium+Entities shape)', async () => {
  const xml = await readFixture('manifest.entities.xml');
  const entries = parseManifest(xml);
  assert.equal(entries.length, 2);

  const csv = entries.find((e) => e.filename === 'plants.csv');
  assert.ok(csv, 'expected a plants.csv entry');
  assert.equal(csv.type, 'entityList');
  assert.equal(csv.isEntityList, true);
  assert.match(csv.hash, /^md5:/);
  assert.match(csv.downloadUrl, /\/attachments\/plants\.csv$/);
  assert.match(csv.integrityUrl, /\/datasets\/plants\/integrity$/);

  const img = entries.find((e) => e.filename === 'silphium-reference.jpg');
  assert.ok(img, 'expected a silphium-reference.jpg entry');
  assert.equal(img.type, null);
  assert.equal(img.isEntityList, false);
  assert.equal(img.integrityUrl, null);
  assert.match(img.downloadUrl, /\/attachments\/silphium-reference\.jpg$/);
});

test('parseManifest rejects empty input and non-manifest documents', () => {
  assert.throws(() => parseManifest(''), (e) => e.code === ODK_CENTRAL_ERROR_CODES.PARSE);
  assert.throws(
    () => parseManifest('<html><body>Not a manifest</body></html>'),
    (e) => e.code === ODK_CENTRAL_ERROR_CODES.PARSE
  );
});

test('parseFormList extracts a live-captured populated formList with manifestUrl', async () => {
  const xml = await readFixture('formList.live.xml');
  const forms = parseFormList(xml);
  assert.equal(forms.length, 1);
  assert.equal(forms[0].formId, 'silphium_flower_survey');
  assert.equal(forms[0].hash, 'md5:638805732850a84f0870f26241437c38');
  assert.match(forms[0].manifestUrl, /\/manifest$/);
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

test('extractInstanceId reads meta/instanceID and tolerates absence', () => {
  assert.equal(
    extractInstanceId('<data><meta><instanceID>uuid:xyz</instanceID></meta></data>'),
    'uuid:xyz'
  );
  assert.equal(extractInstanceId('<data/>'), null);
  assert.equal(extractInstanceId(''), null);
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

test('toFormData wraps string and binary parts as Blobs (regression: live media submit)', async () => {
  const parts = buildSubmissionParts({
    xml: '<data/>',
    attachments: [{ name: 'tiny.png', contentType: 'image/png', data: new Uint8Array([1, 2, 3, 4]) }],
  });
  const form = toFormData(parts);
  const xmlPart = form.get('xml_submission_file');
  const imgPart = form.get('tiny.png');
  assert.ok(xmlPart instanceof Blob, 'xml part should be a Blob');
  assert.ok(imgPart instanceof Blob, 'binary attachment should be wrapped in a Blob');
  assert.equal(imgPart.type, 'image/png');
  assert.equal(imgPart.size, 4);
  assert.equal(await xmlPart.text(), '<data/>');
});

test('buildSubmissionParts names the XML part xml_submission_file with a submission.xml filename', () => {
  const [xmlPart] = buildSubmissionParts({ xml: '<data/>' });
  assert.equal(xmlPart.name, 'xml_submission_file');
  assert.equal(xmlPart.filename, 'submission.xml');
  assert.equal(xmlPart.contentType, 'text/xml');
});

test('toFormData appends a Blob-like attachment as-is (no File wrapping) with its filename', async () => {
  // Regression for the Expo SDK 57 / RN New-Arch finding: the client must NOT
  // wrap bodies in File; it appends the caller-provided Blob-like body directly
  // via append(fieldName, body, filename). Verified on-device (Blob + Expo File).
  const blob = new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' });
  const parts = buildSubmissionParts({
    xml: '<data/>',
    attachments: [{ name: 'photo.png', contentType: 'image/png', data: blob }],
  });
  const form = toFormData(parts);
  const part = form.get('photo.png');
  assert.ok(part instanceof Blob, 'attachment should serialize as a file part');
  assert.equal(part.size, 3);
  assert.equal(part.type, 'image/png');
});
