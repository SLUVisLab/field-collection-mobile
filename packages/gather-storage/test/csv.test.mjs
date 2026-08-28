import test from 'node:test';
import assert from 'node:assert/strict';

import { CsvError, parseCsv, serializeCsv } from '../src/csv.js';

test('CSV codec handles quoted commas, escaped quotes, embedded newlines, and CRLF', () => {
  const input = 'name,label,note\r\none,"A, ""quoted"" label","line 1\r\nline 2"\r\ntwo,,plain\r\n';
  const records = parseCsv(input);
  assert.deepEqual(records, [
    ['name', 'label', 'note'],
    ['one', 'A, "quoted" label', 'line 1\r\nline 2'],
    ['two', '', 'plain'],
  ]);
  assert.equal(serializeCsv(records), input);
});

test('CSV serializer quotes every syntax-significant field and retains empty fields', () => {
  const encoded = serializeCsv([
    ['comma', 'quote', 'newline', 'empty'],
    ['a,b', 'a"b', 'a\nb', ''],
  ]);
  assert.equal(encoded, 'comma,quote,newline,empty\r\n"a,b","a""b","a\nb",\r\n');
  assert.deepEqual(parseCsv(encoded), [
    ['comma', 'quote', 'newline', 'empty'],
    ['a,b', 'a"b', 'a\nb', ''],
  ]);
});

test('CSV parser rejects malformed quotes rather than silently changing data', () => {
  assert.throws(() => parseCsv('name\n"unterminated'), CsvError);
  assert.throws(() => parseCsv('name\n"closed"x'), CsvError);
  assert.throws(() => parseCsv('name\nbad"quote'), CsvError);
});
