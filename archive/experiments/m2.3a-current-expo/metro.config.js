const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const appRoot = __dirname;
const mode = process.env.M23B_XFORMS_MODE ?? 'stock';
const config = getDefaultConfig(appRoot);

if (mode === 'import-condition') {
  config.resolver.unstable_conditionNames = [...(config.resolver.unstable_conditionNames ?? []), 'import'];
}

if (mode === 'alias-dist' || mode === 'compat') {
  const distPath = path.join(appRoot, 'node_modules', '@getodk', 'xforms-engine', 'dist', 'index.js');
  const compatPath = path.join(appRoot, 'gate', 'm23b', 'compat', 'index.js');
  const targetPath = mode === 'alias-dist' ? distPath : compatPath;

  if (!fs.existsSync(targetPath)) {
    throw new Error(`M23B mode "${mode}" requires existing file: ${targetPath}`);
  }

  const originalResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === '@getodk/xforms-engine') {
      return {
        type: 'sourceFile',
        filePath: targetPath,
      };
    }
    if (typeof originalResolveRequest === 'function') {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
