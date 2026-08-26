const path = require('node:path');

const JS_DOM_GLOBAL_BINDINGS = [
  'window',
  'document',
  'DOMParser',
  'XMLSerializer',
  'Document',
  'Element',
  'Node',
  'Attr',
  'DOMException',
  'NodeList',
  'NamedNodeMap',
  'XMLDocument',
];

const loadJSDOM = () => {
  try {
    return require('jsdom');
  } catch {
    const fallbackPath = path.join(
      process.cwd(),
      'experiments',
      'm1-dom-contract',
      'node_modules',
      'jsdom'
    );
    return require(fallbackPath);
  }
};

const installJsdomDomCompatibility = (options = {}) => {
  const { force = true } = options;
  const { JSDOM } = loadJSDOM();
  const jsdom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://example.test/',
    contentType: 'text/html',
  });

  const { window } = jsdom;
  const previousValues = new Map();

  for (const key of JS_DOM_GLOBAL_BINDINGS) {
    if (!force && globalThis[key] != null) {
      continue;
    }
    previousValues.set(key, globalThis[key]);
    globalThis[key] = window[key];
  }

  return {
    jsdom,
    restore() {
      for (const [key, previousValue] of previousValues.entries()) {
        if (previousValue === undefined) {
          delete globalThis[key];
        } else {
          globalThis[key] = previousValue;
        }
      }
      window.close();
    },
  };
};

module.exports = {
  installJsdomDomCompatibility,
};
