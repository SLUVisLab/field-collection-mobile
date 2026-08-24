const FIREBASE_HOST_SUBSTRING = 'firebasestorage.googleapis.com';
const SUPPORTED_MEDIA_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv',
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'
]);
const logger = require('../utils/logger');

function isString(value) {
  return typeof value === 'string';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractFilenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(FIREBASE_HOST_SUBSTRING)) {
      return null;
    }

    const rawPath = parsed.pathname.split('/o/').pop() || parsed.pathname;
    const decodedPath = decodeURIComponent(rawPath);
    const segments = decodedPath.split('/');
    const filename = segments.pop() || null;
    return filename || null;
  } catch (error) {
    return null;
  }
}

function hasSupportedExtension(filename) {
  if (!filename) {
    return false;
  }

  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return false;
  }

  const extension = filename.slice(lastDot + 1).toLowerCase();
  return SUPPORTED_MEDIA_EXTENSIONS.has(extension);
}

function isLikelyFirebaseMediaUrl(candidate) {
  if (!isString(candidate) || !candidate.trim()) {
    return false;
  }

  const filename = extractFilenameFromUrl(candidate.trim());
  return Boolean(filename && hasSupportedExtension(filename));
}

function collectMediaEntries(observations = []) {
  if (!Array.isArray(observations)) {
    return { mediaEntries: [], mediaCount: 0 };
  }

  const mediaEntries = [];

  logger.debug('[Media] collectMediaEntries invoked for observations:', observations.length);

  const walkValue = (container, key, value, breadcrumbs) => {
    if (key && key.endsWith('_path')) {
      return;
    }

    const pathLabel = breadcrumbs.join('.');

    if (Array.isArray(value)) {
  logger.debug('[Media] Inspecting array field for media:', pathLabel, 'length:', value.length);
      const siblingKey = key ? `${key}_path` : null;
      const siblingArray = siblingKey ? Array(value.length).fill(null) : null;
      let foundMedia = false;

      value.forEach((item, index) => {
        if (isLikelyFirebaseMediaUrl(item)) {
          const filename = extractFilenameFromUrl(item.trim());
          const archivePath = `media/${filename}`;

          if (siblingArray) {
            siblingArray[index] = archivePath;
          }

          mediaEntries.push({ url: item.trim(), filename, archivePath });
          foundMedia = true;
          logger.debug('[Media] Detected media in array:', { path: pathLabel, index, filename });
        } else if (isPlainObject(item)) {
          walkObject(item, breadcrumbs.concat(`[${index}]`));
        } else if (Array.isArray(item)) {
          walkValue(value, `${index}`, item, breadcrumbs.concat(`[${index}]`));
        }
      });

      if (foundMedia && siblingKey && isPlainObject(container)) {
        container[siblingKey] = siblingArray;
  logger.debug('[Media] Added sibling array field:', `${pathLabel}_path`, siblingArray);
      }

      return;
    }

    if (isPlainObject(value)) {
      walkObject(value, breadcrumbs);
      return;
    }

    if (isLikelyFirebaseMediaUrl(value)) {
      const filename = extractFilenameFromUrl(value.trim());
      const archivePath = `media/${filename}`;

      if (isPlainObject(container) && key) {
        container[`${key}_path`] = archivePath;
      }

      mediaEntries.push({ url: value.trim(), filename, archivePath });
  logger.debug('[Media] Detected scalar media:', { path: pathLabel, filename });
    }
  };

  const walkObject = (obj, breadcrumbs) => {
    Object.entries(obj).forEach(([childKey, childValue]) => {
      walkValue(obj, childKey, childValue, breadcrumbs.concat(childKey));
    });
  };

  observations.forEach((observation, index) => {
    if (!isPlainObject(observation)) {
      return;
    }

    walkObject(observation, [`observation[${index}]`]);
  });

  logger.debug('[Media] Media detection complete. Total media entries:', mediaEntries.length);

  return {
    mediaEntries,
    mediaCount: mediaEntries.length
  };
}

module.exports = {
  collectMediaEntries,
  isLikelyFirebaseMediaUrl,
  extractFilenameFromUrl
};
