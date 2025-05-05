// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// If you need any customizations, add them here
// For example:
// config.resolver.assetExts.push('db');

module.exports = config;