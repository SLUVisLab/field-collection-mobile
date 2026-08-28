// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// This repo is its own monorepo root: the app lives at the root and the
// first-party libraries live in packages/* (linked via npm workspaces).
// Watch the packages so Metro picks up edits to their source.
config.watchFolders = [path.resolve(projectRoot, 'packages')];

// Resolve modules from the root node_modules (where workspace packages are linked).
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
