/**
 * Render-free logic for the mobile Basic Catalog implementations.
 *
 * Kept separate from `basicCatalog.js` (which contains JSX) so it is directly
 * testable under `node --test`, mirroring the `mediaModel.js` convention in
 * `gather-components`.
 */

/**
 * Maps the Basic Catalog `fit` enum onto a React Native `resizeMode`.
 *
 * `fill` is the upstream default. React Native has no `scale-down`, so it
 * approximates to `contain` — the difference only shows for images smaller than
 * their container, which `contain` scales up and `scaleDown` would not.
 */
export const resizeModeForFit = (fit) => {
  switch (fit) {
    case 'contain':
      return 'contain';
    case 'cover':
      return 'cover';
    case 'none':
      return 'center';
    case 'scaleDown':
      return 'contain';
    case 'fill':
    default:
      return 'stretch';
  }
};

/** Aspect ratio from an RN image load event, or null when it is unusable. */
export const aspectRatioFromLoad = (event) => {
  const { width, height } = event?.nativeEvent?.source ?? {};
  if (typeof width !== 'number' || typeof height !== 'number') return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return width / height;
};

/** Placeholder ratio held until the intrinsic ratio is known, so layout is stable. */
export const DEFAULT_IMAGE_ASPECT_RATIO = 4 / 3;
