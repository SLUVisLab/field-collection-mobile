// Pure, render-free helpers backing `MediaGallery`. Kept separate from the JSX so
// selection/ordering behavior is unit-testable without a native renderer. These
// functions never mutate their inputs and never touch device/DOM APIs.

/**
 * Derives a stable identity for a media item, preferring durable asset ids and
 * falling back to a location or the positional index. Also accepts a bare string
 * (a caller-supplied selection key).
 */
export const mediaItemKey = (item, index = 0) => {
  if (item == null) return String(index);
  if (typeof item === 'string') return item;
  const candidate = item.assetId ?? item.id ?? item.uri ?? item.path;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : String(index);
};

/**
 * Normalizes an arbitrary `items` prop into display entries. Every array element
 * is preserved (with its original index, so remove/reorder events map back to the
 * caller's array) and duck-typed for a display `uri`/dimensions — the gallery is
 * presentation-only and does not require the typed asset contracts.
 */
export const normalizeMediaItems = (items) => {
  const list = Array.isArray(items) ? items : [];
  return list.map((item, index) => ({
    item,
    index,
    key: mediaItemKey(item, index),
    uri: typeof item?.uri === 'string' && item.uri.length > 0 ? item.uri : null,
    width: typeof item?.width === 'number' ? item.width : null,
    height: typeof item?.height === 'number' ? item.height : null,
  }));
};

/**
 * Builds the set of currently-selected keys from either the single-select
 * (`selectedItem`) or multi-select (`selectedItems`) prop. Each value may be an
 * item object or a bare key string.
 */
export const selectionKeySet = ({ selectedItem = null, selectedItems = null } = {}) => {
  const keys = new Set();
  if (Array.isArray(selectedItems)) {
    for (const value of selectedItems) {
      if (value != null) keys.add(mediaItemKey(value));
    }
  }
  if (selectedItem != null) keys.add(mediaItemKey(selectedItem));
  return keys;
};

/**
 * Returns a new array with the element at `from` moved to `to`. Out-of-range or
 * no-op moves return the original array reference unchanged.
 */
export const moveItem = (list, from, to) => {
  if (!Array.isArray(list)) return [];
  const size = list.length;
  if (from < 0 || from >= size || to < 0 || to >= size || from === to) return list;
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.3gp'];

/**
 * Classifies a media item as `'video'` or `'photo'` from its declared type,
 * falling back to a duration hint and finally a file extension. Presentation
 * only — the gallery accepts mixed photo/video collections and never inspects
 * bytes. Defaults to `'photo'` when nothing indicates video.
 */
export const mediaKind = (item) => {
  if (!item || typeof item !== 'object') return 'photo';
  const declared = item.mediaType ?? item.kind ?? item.type;
  if (declared === 'video' || declared === 'photo' || declared === 'image') {
    return declared === 'image' ? 'photo' : declared;
  }
  const mime = item.mimeType ?? item.contentType;
  if (typeof mime === 'string') {
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('image/')) return 'photo';
  }
  if (typeof item.durationMs === 'number' && item.durationMs > 0) return 'video';
  const location = typeof item.path === 'string' ? item.path : item.uri;
  if (typeof location === 'string') {
    const lower = location.toLowerCase();
    if (VIDEO_EXTENSIONS.some((ext) => lower.includes(ext))) return 'video';
  }
  return 'photo';
};

/** Poster/still image to show for a tile: an explicit poster, else the item uri for photos. */
export const mediaPosterUri = (item) => {
  if (!item || typeof item !== 'object') return null;
  const poster = item.posterUri ?? item.thumbnailUri ?? item.previewUri;
  if (typeof poster === 'string' && poster.length > 0) return poster;
  if (mediaKind(item) === 'photo' && typeof item.uri === 'string' && item.uri.length > 0) return item.uri;
  return null;
};
