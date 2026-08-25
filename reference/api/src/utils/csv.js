const PRIORITY_COLUMNS = [
  'surveyId',
  'user',
  'timestamp',
  'createdAt',
  'updatedAt',
  'latitude',
  'longitude',
  'location.latitude',
  'location.longitude'
];

function normalizeColumnKey(key) {
  if (key === 'ID') {
    return 'observationID';
  }

  if (typeof key === 'string' && key.startsWith('data.')) {
    return key.slice(5);
  }

  return key;
}

function normalizeRowColumns(row) {
  if (!row || typeof row !== 'object') {
    return row;
  }

  return Object.entries(row).reduce((accumulator, [key, value]) => {
    const normalizedKey = normalizeColumnKey(key);

    if (!normalizedKey) {
      accumulator[key] = value;
      return accumulator;
    }

    if (!(normalizedKey in accumulator)) {
      accumulator[normalizedKey] = value;
      return accumulator;
    }

    if (accumulator[normalizedKey] === '' && value !== '') {
      accumulator[normalizedKey] = value;
    }

    return accumulator;
  }, {});
}

function isPrimitive(value) {
  return value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toISOStringSafe(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : new Date(time).toISOString();
  }

  if (typeof value.toDate === 'function') {
    return toISOStringSafe(value.toDate());
  }

  if (typeof value.getTime === 'function') {
    try {
      const time = value.getTime();
      return Number.isNaN(time) ? null : new Date(time).toISOString();
    } catch (error) {
      return null;
    }
  }

  if (typeof value === 'object') {
    const seconds = value._seconds ?? value.seconds;
    const nanos = value._nanoseconds ?? value.nanoseconds ?? 0;

    if (typeof seconds === 'number') {
      const millis = Math.round(seconds * 1000 + nanos / 1e6);
      return new Date(millis).toISOString();
    }
  }

  return null;
}

function formatPrimitive(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value === true) {
    return 'true';
  }

  if (value === false) {
    return 'false';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  return String(value);
}

function stringifyComplex(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  const isoString = toISOStringSafe(value);
  if (isoString) {
    return isoString;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    if (typeof value.toString === 'function') {
      return value.toString();
    }

    return '';
  }
}

function flattenRecord(record) {
  if (!isPlainObject(record)) {
    return [{}];
  }

  const seen = new WeakSet();
  const fieldStore = new Map();

  const setScalarField = (path, value) => {
    if (!path) {
      return;
    }
    fieldStore.set(path, {
      type: 'scalar',
      value: formatPrimitive(value)
    });
  };

  const setArrayField = (path, values) => {
    if (!path) {
      return;
    }

    const normalized = values.map((item) => {
      if (isPrimitive(item)) {
        return formatPrimitive(item);
      }

      const isoString = toISOStringSafe(item);
      if (isoString) {
        return isoString;
      }

      if (Array.isArray(item) || isPlainObject(item)) {
        return stringifyComplex(item);
      }

      return formatPrimitive(item);
    });

    fieldStore.set(path, {
      type: 'array',
      values: normalized
    });
  };

  const visit = (value, path) => {
    if (path && path.length > 512) {
      fieldStore.set(path.slice(0, 512), {
        type: 'scalar',
        value: stringifyComplex(value)
      });
      return;
    }

    if (value === null || value === undefined) {
      setScalarField(path, '');
      return;
    }

    if (isPrimitive(value)) {
      setScalarField(path, value);
      return;
    }

    const isoString = toISOStringSafe(value);
    if (isoString) {
      setScalarField(path, isoString);
      return;
    }

    if (typeof value !== 'object') {
      setScalarField(path, value);
      return;
    }

    if (seen.has(value)) {
      setScalarField(path, '[Circular]');
      return;
    }

    seen.add(value);

    if (Array.isArray(value)) {
      setArrayField(path, value);
      return;
    }

    if (isPlainObject(value)) {
      const keys = Object.keys(value);

      if (keys.length === 0) {
        setScalarField(path, '');
        return;
      }

      keys.forEach((childKey) => {
        const childPath = path ? `${path}.${childKey}` : childKey;
        visit(value[childKey], childPath);
      });
      return;
    }

    setScalarField(path, stringifyComplex(value));
  };

  Object.keys(record).forEach((key) => {
    visit(record[key], key);
  });

  let rowCount = 1;
  for (const field of fieldStore.values()) {
    if (field.type === 'array') {
      rowCount = Math.max(rowCount, field.values.length);
    }
  }

  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    const row = {};
    for (const [path, field] of fieldStore.entries()) {
      if (field.type === 'scalar') {
        row[path] = field.value;
      } else {
        row[path] = index < field.values.length ? field.values[index] : '';
      }
    }
    rows.push(row);
  }

  return rows;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  if (stringValue === '') {
    return '';
  }

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function buildColumnOrder(flattenedRows) {
  const seen = new Set();
  const order = [];

  flattenedRows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    });
  });

  const prioritized = PRIORITY_COLUMNS.filter((key) => seen.has(key));
  const prioritizedSet = new Set(prioritized);
  const rest = order.filter((key) => !prioritizedSet.has(key));

  return [...prioritized, ...rest];
}

function generateCsvString(columns, rows) {
  const header = columns.map(escapeCsvValue).join(',');
  const lines = [header];

  rows.forEach((row) => {
    const line = columns
      .map((column) => escapeCsvValue(column in row ? row[column] : ''))
      .join(',');
    lines.push(line);
  });

  return lines.join('\n') + '\n';
}

function createObservationCsv(observations = []) {
  const flattenedRows = [];

  if (Array.isArray(observations)) {
    observations.forEach((observation) => {
      const rows = flattenRecord(observation);
      rows.forEach((row) => {
        flattenedRows.push(normalizeRowColumns(row));
      });
    });
  }

  const columns = buildColumnOrder(flattenedRows);

  const activeColumns = columns.filter((column) =>
    flattenedRows.some((row) => {
      const value = row[column];
      if (value === undefined || value === null) {
        return false;
      }

      if (typeof value === 'string') {
        return value.trim().length > 0;
      }

      return true;
    })
  );

  const csv = generateCsvString(activeColumns, flattenedRows);

  return {
    csv,
    columns: activeColumns,
    rows: flattenedRows
  };
}

module.exports = {
  createObservationCsv,
  flattenRecord
};