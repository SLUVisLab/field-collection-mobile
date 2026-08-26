# Candidate DOM library coverage

| Candidate | Raw coverage | Portable coverage | Critical gaps | Important gaps | Easy-shim gaps |
|---|---:|---:|---:|---:|---:|
| jsdom (reference) | 100.0% (52/52) | 100.0% (47/47) | 0 | 0 | 0 |
| slimdom | 86.5% (45/52) | 91.5% (43/47) | 0 | 3 | 1 |
| @oozcitak/dom | 88.5% (46/52) | 89.4% (42/47) | 0 | 4 | 1 |
| @xmldom/xmldom | 65.4% (34/52) | 70.2% (33/47) | 3 | 4 | 7 |
| linkedom | 78.8% (41/52) | 83.0% (39/47) | 5 | 2 | 1 |

## jsdom (reference)

- Raw coverage: 100.0% (52/52)
- Portable coverage: 100.0% (47/47)
- Critical gaps: 0
- Important gaps: 0
- Easy-shim gaps: 0

## slimdom

- Raw coverage: 86.5% (45/52)
- Portable coverage: 91.5% (43/47)
- Critical gaps: 0
- Important gaps: 3
- Easy-shim gaps: 1
- Important missing:
  - `Element.matches`
  - `Element.querySelector`
  - `Element.querySelectorAll`
- Easy-shim missing:
  - `Document.currentScript`

## @oozcitak/dom

- Raw coverage: 88.5% (46/52)
- Portable coverage: 89.4% (42/47)
- Critical gaps: 0
- Important gaps: 4
- Easy-shim gaps: 1
- Important missing:
  - `Element.matches`
  - `Element.outerHTML`
  - `Element.querySelector`
  - `Element.querySelectorAll`
- Easy-shim missing:
  - `Document.currentScript`

## @xmldom/xmldom

- Raw coverage: 65.4% (34/52)
- Portable coverage: 70.2% (33/47)
- Critical gaps: 3
- Important gaps: 4
- Easy-shim gaps: 7
- Critical missing:
  - `Element.append`
  - `Element.remove`
  - `Element.replaceWith`
- Important missing:
  - `Element.matches`
  - `Element.outerHTML`
  - `Element.querySelector`
  - `Element.querySelectorAll`
- Easy-shim missing:
  - `Attr.value`
  - `Document.children`
  - `Document.currentScript`
  - `Element.children`
  - `Element.prepend`
  - `ParentNode.firstElementChild`
  - `ParentNode.lastElementChild`

## linkedom

- Raw coverage: 78.8% (41/52)
- Portable coverage: 83.0% (39/47)
- Critical gaps: 5
- Important gaps: 2
- Easy-shim gaps: 1
- Critical missing:
  - `Attr.namespaceURI`
  - `Attr.prefix`
  - `Element.prefix`
  - `Node.lookupNamespaceURI`
  - `Node.lookupPrefix`
- Important missing:
  - `XMLSerializer.<constructor>`
  - `XMLSerializer.serializeToString`
- Easy-shim missing:
  - `Document.currentScript`

