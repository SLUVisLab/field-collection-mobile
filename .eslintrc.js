// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: ['expo', 'prettier'],
  ignorePatterns: [
    // Dependencies
    'node_modules/**',
    
    // Expo specific
    '.expo/**',
    '.expo-shared/**',
    'web-build/**',
    
    // Build outputs
    'dist/**',
    'build/**',
    
    // Generated files
    '**/*.generated.js',
    '**/*.generated.jsx',
    
    // Test coverage
    'coverage/**',
    
    // Other common ignores
    '.git/**',
    '*.log',
    'babel.config.js', // Often auto-generated or minimal config
    'metro.config.js',  // Often auto-generated or minimal config
    'app.json',
    'eas.json',
    
    // iOS/Android native generated files
    'ios/Pods/**',
    'android/build/**',
    'android/app/build/**',
  ],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'warn',
  },
};