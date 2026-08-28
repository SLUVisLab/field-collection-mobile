// Side-effect module: installs the slimdom DOM compatibility layer BEFORE the
// xforms-engine module is evaluated.
//
// The engine kicks off its Tree-sitter/XPath parser initialization at module
// evaluation time. Under a browser-like runtime (React Native defines a global
// `window`), the bundled web-tree-sitter glue reads `window.document.currentScript`
// during that init. If `document` isn't present yet, evaluation throws before any
// application code runs. Importing this module first guarantees the globals exist.
//
// This must be imported before anything that (transitively) imports
// `@getodk/xforms-engine`.
const { installSlimdomDomCompatibility } = require('./installDomCompatibility.cjs');

installSlimdomDomCompatibility({ force: true });
