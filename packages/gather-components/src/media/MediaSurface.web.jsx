// Web media surface for the viewer: raw DOM <video>/<img>, consistent with the
// web camera seam. No player dependency is pulled into the web bundle.
export function MediaSurface({ kind, uri }) {
  if (!uri) return null;
  if (kind === 'video') {
    return (
      <video
        src={uri}
        controls
        autoPlay
        playsInline
        style={{ maxWidth: '100%', maxHeight: '100%', outline: 'none' }}
      />
    );
  }
  return (
    <img src={uri} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
  );
}
