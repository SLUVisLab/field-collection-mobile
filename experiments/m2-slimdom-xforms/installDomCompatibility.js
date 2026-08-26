const slimdom = require('slimdom');
const { installSlimdomSelectorAdapter } = require('./selectorAdapter');

const DEFAULT_GLOBAL_BINDINGS = [
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

const installSlimdomDomCompatibility = (options = {}) => {
  const { force = true } = options;
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

  for (const key of DEFAULT_GLOBAL_BINDINGS) {
    if (!force && globalThis[key] != null) {
      continue;
    }
    previousValues.set(key, globalThis[key]);
    globalThis[key] = bindings[key];
  }

  const restoreSelectorAdapter = installSlimdomSelectorAdapter({
    ElementClass: slimdom.Element,
    DocumentClass: slimdom.Document,
  });

  return {
    slimdom,
    restore() {
      restoreSelectorAdapter();
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
