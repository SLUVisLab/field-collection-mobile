# DOM compatibility contract

- Generated: 2026-08-26T00:49:38.839Z
- Engine version: `1.0.3`
- XPath source mode: `vendored-source`
- Static requirements: 46
- Dynamic requirements: 41
- Dynamic status: `ok`

## Attr

- `localName` (static: yes, dynamic: yes, usage: get, categories: namespace)
- `namespaceURI` (static: yes, dynamic: yes, usage: get, categories: namespace)
- `nodeType` (static: yes, dynamic: no, usage: get, categories: constants)
- `prefix` (static: yes, dynamic: yes, usage: get, categories: namespace)
- `value` (static: yes, dynamic: yes, usage: get, categories: other)

## CharacterData

- `data` (static: yes, dynamic: yes, usage: get, categories: other)

## ChildNode

- `nodeType` (static: yes, dynamic: no, usage: get, categories: constants)
- `nodeValue` (static: yes, dynamic: no, usage: get, categories: other)

## Document

- `children` (static: no, dynamic: yes, usage: get, categories: other)
- `compatMode` (static: no, dynamic: yes, usage: get, categories: other)
- `contentType` (static: no, dynamic: yes, usage: get, categories: other)
- `createElement` (static: no, dynamic: yes, usage: call, categories: other)
- `createElementNS` (static: yes, dynamic: yes, usage: call, categories: namespace)
- `currentScript` (static: no, dynamic: yes, usage: get, categories: other)
- `documentElement` (static: no, dynamic: yes, usage: get, categories: other)
- `readyState` (static: no, dynamic: yes, usage: get, categories: other)

## DOMParser

- `<constructor>` (static: yes, dynamic: yes, usage: new, categories: global-constructor)
- `parseFromString` (static: yes, dynamic: yes, usage: call, categories: other)

## Element

- `append` (static: yes, dynamic: yes, usage: call, categories: other)
- `attributes` (static: yes, dynamic: yes, usage: get, categories: other)
- `childNodes` (static: yes, dynamic: no, usage: get, categories: other)
- `children` (static: yes, dynamic: yes, usage: get, categories: other)
- `cloneNode` (static: yes, dynamic: no, usage: call, categories: mutation)
- `firstChild` (static: yes, dynamic: no, usage: get, categories: other)
- `getAttribute` (static: yes, dynamic: yes, usage: call, categories: other)
- `getAttributeNS` (static: yes, dynamic: yes, usage: call, categories: namespace)
- `getElementsByTagName` (static: no, dynamic: yes, usage: call, categories: other)
- `hasAttribute` (static: yes, dynamic: yes, usage: call, categories: other)
- `localName` (static: yes, dynamic: yes, usage: get, categories: namespace)
- `matches` (static: no, dynamic: yes, usage: call, categories: selector)
- `namespaceURI` (static: yes, dynamic: yes, usage: get, categories: namespace)
- `nodeName` (static: yes, dynamic: no, usage: get, categories: constants)
- `outerHTML` (static: yes, dynamic: yes, usage: get, categories: serialization)
- `ownerDocument` (static: yes, dynamic: no, usage: get, categories: other)
- `prefix` (static: yes, dynamic: yes, usage: get, categories: namespace)
- `prepend` (static: yes, dynamic: no, usage: call, categories: other)
- `querySelector` (static: no, dynamic: yes, usage: call, categories: selector)
- `querySelectorAll` (static: yes, dynamic: yes, usage: call, categories: selector)
- `remove` (static: yes, dynamic: no, usage: call, categories: other)
- `replaceWith` (static: yes, dynamic: no, usage: call, categories: other)
- `setAttribute` (static: yes, dynamic: yes, usage: call, categories: mutation)
- `setAttributeNS` (static: yes, dynamic: yes, usage: call, categories: namespace)
- `textContent` (static: yes, dynamic: no, usage: get, categories: serialization)

## HTMLElement

- `appendChild` (static: yes, dynamic: no, usage: call, categories: mutation)
- `children` (static: yes, dynamic: no, usage: get, categories: other)
- `outerHTML` (static: yes, dynamic: no, usage: get, categories: serialization)
- `setAttribute` (static: yes, dynamic: no, usage: call, categories: mutation)
- `textContent` (static: yes, dynamic: no, usage: set, categories: serialization)

## NamedNodeMap

- `length` (static: no, dynamic: yes, usage: get, categories: other)

## Node

- `childNodes` (static: no, dynamic: yes, usage: get, categories: other)
- `data` (static: yes, dynamic: no, usage: get, categories: other)
- `lookupNamespaceURI` (static: no, dynamic: yes, usage: call, categories: namespace)
- `lookupPrefix` (static: yes, dynamic: yes, usage: call, categories: namespace)
- `nodeName` (static: no, dynamic: yes, usage: get, categories: constants)
- `nodeType` (static: yes, dynamic: yes, usage: get, categories: constants)
- `ownerDocument` (static: no, dynamic: yes, usage: get, categories: other)
- `parentElement` (static: no, dynamic: yes, usage: get, categories: other)
- `textContent` (static: no, dynamic: yes, usage: get, categories: serialization)

## NodeList

- `length` (static: no, dynamic: yes, usage: get, categories: other)

## ParentNode

- `firstElementChild` (static: yes, dynamic: no, usage: get, categories: other)
- `lastElementChild` (static: yes, dynamic: no, usage: get, categories: other)

## XMLDocument

- `documentElement` (static: yes, dynamic: no, usage: get, categories: other)

## XMLSerializer

- `<constructor>` (static: yes, dynamic: no, usage: new, categories: global-constructor, serialization)
- `serializeToString` (static: yes, dynamic: no, usage: call, categories: serialization)

