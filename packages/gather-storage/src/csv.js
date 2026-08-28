/**
 * Small RFC 4180-style CSV codec for Entity List resources. It intentionally
 * handles only text CSV and preserves every parsed field as a string.
 */

export class CsvError extends Error {
  constructor(message, { offset = null } = {}) {
    super(message);
    this.name = 'CsvError';
    this.offset = offset;
  }
}

const fail = (message, offset) => {
  throw new CsvError(message, { offset });
};

/**
 * Parse comma-delimited records with quoted fields, escaped quotes, and CRLF,
 * LF, or CR record endings. A final line ending does not add a spurious record.
 */
export const parseCsv = (input) => {
  if (typeof input !== 'string') {
    fail('CSV input must be a string', null);
  }
  if (input.length === 0) return [];

  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  let atRecordStart = true;

  const finishField = () => {
    record.push(field);
    field = '';
    quoted = false;
    afterQuote = false;
  };
  const finishRecord = () => {
    finishField();
    records.push(record);
    record = [];
    atRecordStart = true;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === ',') {
        finishField();
        atRecordStart = true;
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && input[index + 1] === '\n') index += 1;
        finishRecord();
      } else {
        fail('Unexpected character after closing CSV quote', index);
      }
      continue;
    }

    if (character === '"') {
      if (!atRecordStart || field.length > 0) {
        fail('CSV quote must begin a field', index);
      }
      quoted = true;
      atRecordStart = false;
    } else if (character === ',') {
      finishField();
      atRecordStart = true;
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      finishRecord();
    } else {
      field += character;
      atRecordStart = false;
    }
  }

  if (quoted) fail('Unterminated quoted CSV field', input.length);
  if (afterQuote || field.length > 0 || record.length > 0 || !atRecordStart) {
    finishRecord();
  }
  return records;
};

const encodeField = (value) => {
  if (value == null) return '';
  if (typeof value !== 'string') {
    throw new CsvError('CSV fields must be strings or null');
  }
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
};

/** Serialize rows as canonical CRLF CSV without changing field contents. */
export const serializeCsv = (records) => {
  if (!Array.isArray(records)) {
    throw new CsvError('CSV records must be an array');
  }
  return records.map((record) => {
    if (!Array.isArray(record)) {
      throw new CsvError('Each CSV record must be an array');
    }
    return record.map(encodeField).join(',');
  }).join('\r\n') + (records.length > 0 ? '\r\n' : '');
};
