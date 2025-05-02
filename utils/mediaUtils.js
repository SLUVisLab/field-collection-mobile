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

export const generateDescriptiveFilename = ({
    parent,
    subcollection,
    item,
    itemID,
    index,
    extension = 'jpg',
  }) => {

    // Filename composition:
    // {parent}-{subcollection}-{item}-id{itemID}_img{index}_{timestamp}.{extension}
    // - Words within fields use dashes (-) to replace spaces
    // - Underscores (_) separate major parts of the name
    // - 'img{index}' is omitted for single media files
    // - Timestamp is in the format YYYYMMDDHHMMSS (to ensure uniqueness and temporal context)

    const safe = (str) =>
      str?.toLowerCase()?.replace(/\s+/g, '-')?.replace(/[^a-z0-9-]/g, '') ?? 'unknown';
  
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14); // e.g. 20240501_153045
  
    const nameParts = [
      safe(parent),
      safe(subcollection),
      safe(item),
      `id${itemID}`,
      index !== undefined ? `img${index}` : null,
      timestamp,
    ];
  
    return `${nameParts.filter(Boolean).join('_')}.${extension}`;
  };
