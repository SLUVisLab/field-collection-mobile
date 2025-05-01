import { v4 as uuidv4 } from 'uuid';

const MEDIA_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'heic'];

export const isMedia = (value) => {
  if (typeof value === 'string') {
    return MEDIA_EXTENSIONS.some(ext => value.toLowerCase().endsWith(ext));
  }
  return false;
};

export const getFileExtensionFromPathOrBlob = (path, blob) => {
  if (typeof path === 'string') {
    const parts = path.split('.');
    if (parts.length > 1) {
      return parts.pop().split('?')[0].toLowerCase();
    }
  }

  if (blob?.type) {
    const match = blob.type.match(/\/([a-zA-Z0-9]+)$/);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  console.warn(`⚠️ Could not determine file extension for: ${path || 'unknown path'}, defaulting to .jpg`);
  return 'jpg';
};

export const generateDescriptiveFilename = ({ parent, subcollection, item, itemID, index, extension = 'jpg' }) => {
    // Replace spaces with dashes within a value, strip other non-alphanumeric except dashes
    const safe = (str) =>
      str?.toLowerCase()
        ?.trim()
        ?.replace(/\s+/g, '-')      // Replace spaces with dashes
        ?.replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric except dash
      ?? 'unknown';
  
    const nameParts = [
      safe(parent),
      safe(subcollection),
      safe(item),
      `id${itemID}`,
      index !== undefined ? `img${index}` : null,
      uuidv4().slice(0, 8),
    ];
  
    return `${nameParts.filter(Boolean).join('_')}.${extension}`;
  };
