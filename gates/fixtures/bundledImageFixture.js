import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

export const BUNDLED_FLOWER_IMAGE_FIXTURE = Object.freeze({
  contentType: 'image/jpeg',
  label: 'bundled plant-field fixture image',
});

/**
 * Materializes the deterministic gate fixture as an existing local Expo File.
 */
export const loadBundledFlowerImageFixture = async () => {
  const [asset] = await Asset.loadAsync(require('../../assets/plantField.jpg'));
  if (!asset?.localUri) {
    throw new Error('Bundled fixture image was not materialized locally.');
  }
  const file = new File(asset.localUri);
  if (!file.exists) {
    throw new Error('Bundled fixture image is unavailable.');
  }
  return {
    file,
    contentType: BUNDLED_FLOWER_IMAGE_FIXTURE.contentType,
    label: BUNDLED_FLOWER_IMAGE_FIXTURE.label,
  };
};
