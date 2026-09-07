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
config.resolver.assetExts.push('onnx');
config.resolver.assetExts.push('txt');

// Keep the frozen legacy app + experiments (archive/) out of the module graph.
// It contains large vendored trees (incl. ~1k TypeScript files) that are not part
// of the app and would otherwise be scanned/watched by Metro.
const archiveDir = path.resolve(projectRoot, 'archive');
const escaped = archiveDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = new RegExp('^' + escaped + '/.*');

module.exports = config;
