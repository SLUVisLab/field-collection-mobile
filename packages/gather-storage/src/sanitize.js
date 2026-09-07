/**
 * Keep diagnostic metadata useful without allowing credentials or unbounded
 * server responses into SQLite or user-visible retry messages.
 */
export const sanitizeErrorText = (value, fallback = '') => {
  const fallbackText = typeof fallback === 'string' ? fallback.trim() : '';
  const text =
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : value instanceof Error && typeof value.message === 'string'
        ? value.message.trim()
        : fallbackText;
  const sanitized = text
    .replace(/:\/\/[^/\s:@]+:[^@\s/]+@/g, '://<redacted>@')
    .replace(/(\/key\/)[^/?#\s]+/gi, '$1<redacted>')
    .replace(/([?&](?:st|token|api[_-]?key|password|secret)=)[^&#\s]+/gi, '$1<redacted>')
    .replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, '$1 <redacted>')
    .replace(
      /\b(authorization|token|api[_ -]?key|password|secret)\b\s*["']?\s*[:=]\s*["']?[^,\s;"'}]+/gi,
      '$1=<redacted>'
    );
  return sanitized.slice(0, 500) || fallbackText.slice(0, 500);
};
