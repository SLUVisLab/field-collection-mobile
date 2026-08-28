const slimdom = require('slimdom');
const { installSlimdomSelectorAdapter } = require('./selectorAdapter.cjs');

const GLOBAL_KEYS = [
  'DOMParser',
  'XMLSerializer',
  'Document',
  'XMLDocument',
  'Element',
  'Node',
  'Attr',
  'DOMException',
  'document',
  'NodeList',
  'NamedNodeMap',
];

const installSlimdomDomCompatibility = ({ force = true } = {}) => {
  const previousValues = new Map();

  const bootstrapDocument = new slimdom.DOMParser().parseFromString(
    '<root xmlns="urn:bootstrap"></root>',
    'text/xml'
  );

  const bindings = {
    DOMParser: slimdom.DOMParser,
    XMLSerializer: slimdom.XMLSerializer,
    Document: slimdom.Document,
    XMLDocument: slimdom.XMLDocument,
    Element: slimdom.Element,
    Node: slimdom.Node,
    Attr: slimdom.Attr,
    DOMException: slimdom.DOMException,
    document: bootstrapDocument,
    NodeList: bootstrapDocument.childNodes.constructor,
    NamedNodeMap: bootstrapDocument.documentElement.attributes.constructor,
  };

  for (const key of GLOBAL_KEYS) {
    if (!force && globalThis[key] != null) {
      continue;
    }
    previousValues.set(key, globalThis[key]);
    globalThis[key] = bindings[key];
  }

  const restoreAdapter = installSlimdomSelectorAdapter({
    ElementClass: slimdom.Element,
    DocumentClass: slimdom.Document,
  });

  return {
    slimdom,
    restore() {
      restoreAdapter();
      for (const [key, previousValue] of previousValues.entries()) {
        if (previousValue === undefined) {
          delete globalThis[key];
        } else {
          globalThis[key] = previousValue;
        }
      }
    },
  };
};

module.exports = {
  installSlimdomDomCompatibility,
};
