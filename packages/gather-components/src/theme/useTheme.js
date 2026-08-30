import { useColorScheme } from 'react-native';

import { resolveTheme } from './themes.js';

export { resolveTheme };

export function useTheme() {
  return resolveTheme(useColorScheme());
}
