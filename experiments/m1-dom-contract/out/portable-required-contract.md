# Portable required contract (M1)

- Generated: 2026-08-26T00:49:38.841Z
- Based on observed contract generated at: 2026-08-26T00:49:38.839Z
- Normalized observed requirements: 52
- Portable requirements: 47

- Critical requirements: 24
- Important requirements: 7
- Easy-shim requirements: 16

## Attr

- `localName` (severity: critical, evidence: static)
- `namespaceURI` (severity: critical, evidence: static)
- `prefix` (severity: critical, evidence: static)
- `value` (severity: easy-shim, evidence: static)

## ChildNode

- `nodeValue` (severity: easy-shim, evidence: static)

## Document

- `children` (severity: easy-shim, evidence: dynamic-A)
- `createElement` (severity: easy-shim, evidence: dynamic-B)
- `createElementNS` (severity: critical, evidence: static)
- `currentScript` (severity: easy-shim, evidence: dynamic-A)
- `documentElement` (severity: critical, evidence: static)

## DOMParser

- `<constructor>` (severity: easy-shim, evidence: static)
- `parseFromString` (severity: critical, evidence: static)

## Element

- `append` (severity: critical, evidence: static)
- `appendChild` (severity: critical, evidence: static)
- `attributes` (severity: critical, evidence: static)
- `children` (severity: easy-shim, evidence: static)
- `cloneNode` (severity: critical, evidence: static)
- `firstChild` (severity: easy-shim, evidence: static)
- `getAttribute` (severity: critical, evidence: static)
- `getAttributeNS` (severity: critical, evidence: static)
- `hasAttribute` (severity: easy-shim, evidence: static)
- `localName` (severity: critical, evidence: static)
- `matches` (severity: important, evidence: dynamic-A)
- `namespaceURI` (severity: critical, evidence: static)
- `outerHTML` (severity: important, evidence: static)
- `prefix` (severity: critical, evidence: static)
- `prepend` (severity: easy-shim, evidence: static)
- `querySelector` (severity: important, evidence: dynamic-B)
- `querySelectorAll` (severity: important, evidence: static)
- `remove` (severity: critical, evidence: static)
- `replaceWith` (severity: critical, evidence: static)
- `setAttribute` (severity: critical, evidence: static)
- `setAttributeNS` (severity: critical, evidence: static)

## NamedNodeMap

- `length` (severity: easy-shim, evidence: dynamic-A)

## Node

- `childNodes` (severity: easy-shim, evidence: static)
- `data` (severity: easy-shim, evidence: static)
- `lookupNamespaceURI` (severity: critical, evidence: dynamic-A)
- `lookupPrefix` (severity: critical, evidence: static)
- `nodeName` (severity: critical, evidence: static)
- `nodeType` (severity: critical, evidence: static)
- `ownerDocument` (severity: critical, evidence: static)
- `textContent` (severity: important, evidence: static)

## NodeList

- `length` (severity: easy-shim, evidence: dynamic-A)

## ParentNode

- `firstElementChild` (severity: easy-shim, evidence: static)
- `lastElementChild` (severity: easy-shim, evidence: static)

## XMLSerializer

- `<constructor>` (severity: important, evidence: static)
- `serializeToString` (severity: important, evidence: static)

