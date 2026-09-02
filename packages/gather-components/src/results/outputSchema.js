const DEFAULT_SECTION_ID = 'output';
const DEFAULT_SECTION_LABEL = 'Output';

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseNumber = (value) => {
  if (isFiniteNumber(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumberText = (value, decimals) => {
  const numeric = parseNumber(value);
  if (numeric === null) return null;
  if (typeof decimals === 'number') return numeric.toFixed(decimals);
  if (Number.isInteger(numeric)) return String(numeric);
  return String(Number(numeric.toFixed(2)));
};

const humanizeKey = (value) =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s._-]+/g)
    .filter(Boolean)
    .map((chunk) => `${chunk[0].toUpperCase()}${chunk.slice(1)}`)
    .join(' ');

const pathSegmentsFor = (path) => {
  if (typeof path !== 'string' || path.length === 0) return [];
  const segments = [];
  const matcher = /[^.[\]]+|\[(\d+)\]/g;
  for (const match of path.matchAll(matcher)) {
    if (match[1] !== undefined) {
      segments.push(Number(match[1]));
      continue;
    }
    segments.push(match[0]);
  }
  return segments;
};

export const readPathValue = (source, path) => {
  if (!path) return source;
  return pathSegmentsFor(path).reduce(
    (current, segment) => (current === null || current === undefined ? undefined : current[segment]),
    source
  );
};

const visibleByMetadata = (source, metadata = {}) => {
  if (metadata.visible === false) return false;
  if (typeof metadata.visiblePath === 'string') return Boolean(readPathValue(source, metadata.visiblePath));
  return true;
};

const formatPrimitive = (value, decimals) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') {
    const maybeNumber = toNumberText(value, decimals);
    if (maybeNumber !== null && `${value}`.trim() !== '') return maybeNumber;
    return String(value);
  }
  return null;
};

const formatPercentage = (value, { decimals, scale }) => {
  const numeric = parseNumber(value);
  if (numeric === null) return null;
  const percent = scale === 'percent' ? numeric : numeric * 100;
  return `${percent.toFixed(typeof decimals === 'number' ? decimals : 1)}%`;
};

const formatQuantity = (source, field, value) => {
  const numberText = toNumberText(value, field.decimals);
  if (numberText === null) return null;
  const unit = field.unit ?? readPathValue(source, field.unitPath);
  return unit ? `${numberText} ${unit}` : numberText;
};

const formatArrayItem = (item, field) => {
  if (item === null || item === undefined) return null;
  if (typeof item !== 'object') return formatPrimitive(item, field.itemDecimals);

  const label =
    readPathValue(item, field.itemLabelPath) ??
    item.label ??
    item.name ??
    item.id ??
    null;
  const itemValuePath = field.itemValuePath ?? null;
  const rawValue = itemValuePath ? readPathValue(item, itemValuePath) : null;
  let value = null;
  if (rawValue !== null && rawValue !== undefined) {
    if (field.itemValueFormat === 'percentage') {
      value = formatPercentage(rawValue, {
        decimals: field.itemValueDecimals,
        scale: field.itemValueScale,
      });
    } else if (field.itemValueFormat === 'number') {
      value = toNumberText(rawValue, field.itemValueDecimals);
    } else {
      value = formatPrimitive(rawValue, field.itemValueDecimals);
    }
  }

  if (label && value) return `${label} (${value})`;
  if (label) return String(label);
  if (value) return String(value);
  return null;
};

const formatArray = (value, field) => {
  if (!Array.isArray(value) || value.length === 0) return field.emptyText ?? null;
  const maxItems = typeof field.maxItems === 'number' ? field.maxItems : value.length;
  const rendered = value
    .slice(0, maxItems)
    .map((item) => formatArrayItem(item, field))
    .filter((item) => typeof item === 'string' && item.length > 0);
  return rendered.length ? rendered.join(', ') : field.emptyText ?? null;
};

const basename = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const segments = trimmed.split('/');
  return segments[segments.length - 1] || trimmed;
};

const formatAssetSummary = (value) => {
  if (!value || typeof value !== 'object') return null;
  const mime = value.mimeType ?? value.contentType ?? null;
  const dimensions = value.width && value.height ? `${value.width} x ${value.height}` : null;
  const identity = value.assetId ?? basename(value.path) ?? basename(value.uri) ?? null;
  const parts = [mime, dimensions, identity].filter((part) => typeof part === 'string' && part.length > 0);
  return parts.length ? parts.join(' · ') : 'Asset available';
};

export const formatOutputFieldValue = (source, field) => {
  const value = readPathValue(source, field.path);
  switch (field.format) {
    case 'string':
      return value === null || value === undefined || value === '' ? field.emptyText ?? null : String(value);
    case 'number':
      return toNumberText(value, field.decimals) ?? field.emptyText ?? null;
    case 'boolean':
      return value === null || value === undefined ? field.emptyText ?? null : value ? 'Yes' : 'No';
    case 'quantity':
      return formatQuantity(source, field, value) ?? field.emptyText ?? null;
    case 'percentage':
      return formatPercentage(value, field) ?? field.emptyText ?? null;
    case 'array':
      return formatArray(value, field);
    case 'asset':
      return formatAssetSummary(value) ?? field.emptyText ?? null;
    default:
      return formatPrimitive(value, field.decimals) ?? field.emptyText ?? null;
  }
};

const isQuantityObject = (value) =>
  isPlainObject(value) &&
  (typeof value.value === 'number' || typeof value.value === 'string') &&
  (typeof value.unit === 'string' || value.unit === undefined);

const isAssetObject = (value) =>
  isPlainObject(value) &&
  (typeof value.assetId === 'string' ||
    typeof value.uri === 'string' ||
    typeof value.path === 'string' ||
    typeof value.mimeType === 'string' ||
    typeof value.contentType === 'string');

const isLabelScoreArray = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => isPlainObject(item) && parseNumber(item.score) !== null && (item.label || item.name || item.id));

const inferFieldFormat = (value) => {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
};

const inferOutputFieldDescriptors = (source) => {
  if (!isPlainObject(source)) return [];

  const fields = [];
  let order = 0;

  const pushField = (field) => {
    order += 1;
    fields.push({ order, ...field });
  };

  const walk = (value, path, section) => {
    if (value === null || value === undefined) return;

    if (typeof value !== 'object') {
      pushField({
        path,
        label: humanizeKey(path.split('.').slice(-1)[0]),
        format: inferFieldFormat(value),
        section: section ?? DEFAULT_SECTION_ID,
      });
      return;
    }

    if (Array.isArray(value)) {
      if (isLabelScoreArray(value)) {
        pushField({
          path,
          label: humanizeKey(path.split('.').slice(-1)[0]),
          format: 'array',
          section: section ?? DEFAULT_SECTION_ID,
          maxItems: 3,
          itemLabelPath: 'label',
          itemValuePath: 'score',
          itemValueFormat: 'percentage',
          itemValueScale: 'fraction',
          itemValueDecimals: 1,
        });
      } else {
        pushField({
          path,
          label: humanizeKey(path.split('.').slice(-1)[0]),
          format: 'array',
          section: section ?? DEFAULT_SECTION_ID,
          maxItems: 5,
        });
      }
      return;
    }

    if (isQuantityObject(value)) {
      pushField({
        path: `${path}.value`,
        label: humanizeKey(path.split('.').slice(-1)[0]),
        format: 'quantity',
        unitPath: `${path}.unit`,
        section: section ?? DEFAULT_SECTION_ID,
      });
      return;
    }

    if (isAssetObject(value)) {
      pushField({
        path,
        label: humanizeKey(path.split('.').slice(-1)[0]),
        format: 'asset',
        section: section ?? DEFAULT_SECTION_ID,
      });
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const childSection = section ?? key;
      walk(child, childPath, childSection);
    }
  };

  for (const [key, value] of Object.entries(source)) {
    walk(value, key, key);
  }

  return fields;
};

const normalizeDisplay = (schemaOrDisplay = {}) => ({
  ...schemaOrDisplay,
  sections: Array.isArray(schemaOrDisplay.sections) ? schemaOrDisplay.sections : [],
  fields: Array.isArray(schemaOrDisplay.fields) ? schemaOrDisplay.fields : [],
});

const ordered = (items) =>
  [...items].sort((a, b) => {
    const aOrder = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY;
    const bOrder = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return 0;
  });

export const buildOutputReviewSections = ({ data, schema, display } = {}) => {
  const source = data ?? {};
  const metadata = normalizeDisplay(display ?? schema ?? {});
  const sectionMetadata = new Map();
  const sectionOrder = [];

  for (const section of ordered(metadata.sections)) {
    if (!section?.id || !visibleByMetadata(source, section)) continue;
    sectionMetadata.set(section.id, section);
    sectionOrder.push(section.id);
  }

  const descriptors = metadata.fields.length
    ? ordered(metadata.fields)
    : inferOutputFieldDescriptors(source);

  const rowsBySection = new Map();
  const ensureSection = (sectionId) => {
    if (!rowsBySection.has(sectionId)) rowsBySection.set(sectionId, []);
    if (!sectionMetadata.has(sectionId)) {
      sectionMetadata.set(sectionId, { id: sectionId, label: humanizeKey(sectionId) });
    }
    if (!sectionOrder.includes(sectionId)) sectionOrder.push(sectionId);
  };

  for (const field of descriptors) {
    if (!field?.path || !visibleByMetadata(source, field)) continue;
    const sectionId = field.section ?? DEFAULT_SECTION_ID;
    const sectionMeta = sectionMetadata.get(sectionId);
    if (sectionMeta && !visibleByMetadata(source, sectionMeta)) continue;
    const value = formatOutputFieldValue(source, field);
    if (value === null || value === undefined || value === '') continue;
    ensureSection(sectionId);
    rowsBySection.get(sectionId).push({
      key: field.key ?? field.path,
      label: field.label ?? humanizeKey(field.path.split('.').slice(-1)[0]),
      value,
    });
  }

  return sectionOrder
    .map((sectionId) => {
      const section = sectionMetadata.get(sectionId) ?? {
        id: sectionId,
        label: sectionId === DEFAULT_SECTION_ID ? DEFAULT_SECTION_LABEL : humanizeKey(sectionId),
      };
      const rows = rowsBySection.get(sectionId) ?? [];
      return { id: section.id, label: section.label ?? humanizeKey(section.id), rows };
    })
    .filter((section) => section.rows.length > 0);
};
