import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OdkCentralError,
  ODK_CENTRAL_ERROR_CODES,
  codeForHttpStatus,
  errorFromResponse,
} from '../src/errors.js';

test('codeForHttpStatus maps statuses to stable codes', () => {
  assert.equal(codeForHttpStatus(401), ODK_CENTRAL_ERROR_CODES.AUTH);
  assert.equal(codeForHttpStatus(403), ODK_CENTRAL_ERROR_CODES.FORBIDDEN);
  assert.equal(codeForHttpStatus(404), ODK_CENTRAL_ERROR_CODES.NOT_FOUND);
  assert.equal(codeForHttpStatus(409), ODK_CENTRAL_ERROR_CODES.CONFLICT);
  assert.equal(codeForHttpStatus(422), ODK_CENTRAL_ERROR_CODES.BAD_REQUEST);
  assert.equal(codeForHttpStatus(500), ODK_CENTRAL_ERROR_CODES.SERVER);
  assert.equal(codeForHttpStatus(418), ODK_CENTRAL_ERROR_CODES.GENERIC);
});

test('retryable defaults from code but can be overridden', () => {
  assert.equal(new OdkCentralError('x', { code: ODK_CENTRAL_ERROR_CODES.SERVER }).retryable, true);
  assert.equal(new OdkCentralError('x', { code: ODK_CENTRAL_ERROR_CODES.NETWORK }).retryable, true);
  assert.equal(new OdkCentralError('x', { code: ODK_CENTRAL_ERROR_CODES.AUTH }).retryable, false);
  assert.equal(
    new OdkCentralError('x', { code: ODK_CENTRAL_ERROR_CODES.AUTH, retryable: true }).retryable,
    true
  );
});

test('errorFromResponse surfaces Central JSON message and code', () => {
  const error = errorFromResponse(
    { status: 409, url: 'https://c/v1/projects/1/submission' },
    { bodyJson: { code: 409.15, message: 'A resource already exists with instanceID value.' } }
  );
  assert.equal(error.code, ODK_CENTRAL_ERROR_CODES.CONFLICT);
  assert.equal(error.httpStatus, 409);
  assert.match(error.message, /already exists/);
  assert.equal(error.retryable, false);
});
