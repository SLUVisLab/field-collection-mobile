/**
 * A file surface backed by memory, for a host that has no filesystem.
 *
 * `createModelExecutor` writes a mask and reads it back to hash it — a
 * filesystem shape that is entirely reasonable on a device. In a browser the
 * bytes simply live in a Map for the session, and the object URL is what the
 * preview renders. Nothing here persists, which is correct: a preview mask is
 * not a durable asset.
 */
export const createWebFiles = () => {
  const bytes = new Map();
  const urls = new Map();

  return {
    fileForKey(path) {
      return { uri: `preview:${path}`, exists: bytes.has(path) };
    },
    write(uri, data) {
      bytes.set(uri.replace(/^preview:/, ''), data);
    },
    async readBytes(path) {
      const data = bytes.get(path);
      if (!data) throw new Error(`No preview bytes at ${path}.`);
      return data;
    },
    /**
     * A `preview:` URI turned into something the browser can actually load.
     *
     * The executor asks for a file's URI *before* writing it, which is right on
     * a device and impossible with blob URLs — they are immutable and need
     * their bytes up front. So the preview hands out a `preview:` key, and
     * anything that displays or re-reads the result resolves it here once the
     * bytes exist. Non-preview URIs pass straight through.
     */
    resolveUrl(uri) {
      if (typeof uri !== 'string' || !uri.startsWith('preview:')) return uri;
      return this.objectUrlFor(uri.slice('preview:'.length)) ?? uri;
    },

    /** A URL the page can show. Revoked with the session, not tracked further. */
    objectUrlFor(path) {
      if (urls.has(path)) return urls.get(path);
      const data = bytes.get(path);
      if (!data) return null;
      const url = URL.createObjectURL(new Blob([data], { type: 'image/png' }));
      urls.set(path, url);
      return url;
    },
    clear() {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
      bytes.clear();
    },
  };
};
