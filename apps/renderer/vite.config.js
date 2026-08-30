import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

// The Gather shared Components are authored once as React Native components and
// rendered on the web through react-native-web. That requires: (1) aliasing
// `react-native` to `react-native-web`, (2) transforming JSX that lives in `.js`
// files (the shared RN views), and (3) defining the globals RN source expects.
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/, exclude: /node_modules/ })],
  resolve: {
    alias: { 'react-native': 'react-native-web' },
    extensions: ['.web.js', '.web.jsx', '.js', '.jsx', '.json'],
    dedupe: ['react', 'react-dom', 'react-native-web'],
  },
  define: {
    global: 'globalThis',
    __DEV__: 'false',
    'process.env.NODE_ENV': '"production"',
  },
  optimizeDeps: {
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },
  server: {
    fs: { allow: [repoRoot] },
  },
});
