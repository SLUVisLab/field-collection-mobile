# Observed reference contract (M1)

- Generated: 2026-08-26T00:49:38.839Z
- Engine version: `1.0.3`
- XPath source mode: `vendored-source`
- Raw observed requirements: 64
- Normalized requirements: 52
- Dynamic status: `ok`

## Dynamic-only attribution (M1.2)

- A (Direct ODK): 10
- B (Transitive dependency): 3
- C (Reference environment/internal): 5

- `Document.children` → **A** (Frame resolves inside @getodk/xpath runtime code.)
  - evidence: `at Object.getChildWHATElements (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/@getodk/xpath/dist/index.js:2958:26)`
- `Document.compatMode` → **C** (Frame resolves inside jsdom/selector/instrumentation internals.)
  - evidence: `at switchContext (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/nwsapi/src/nwsapi.js:289:15)`
- `Document.contentType` → **C** (Frame resolves inside jsdom/selector/instrumentation internals.)
  - evidence: `at isHTML (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/nwsapi/src/nwsapi.js:595:15)`
- `Document.createElement` → **B** (Frame resolves inside a transitive runtime dependency invoked by ODK runtime.)
  - evidence: `at <anonymous> (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/@getodk/common/src/lib/dom/compatibility.ts:2:27)`
- `Document.currentScript` → **A** (Frame resolves inside @getodk/xpath runtime code.)
  - evidence: `at <anonymous> (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/@getodk/xpath/dist/expressionParser-i89CXh5o.js:125:38)`
- `Document.documentElement` → **A** (Frame resolves inside @getodk/xforms-engine runtime code.)
  - evidence: `at Factory (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/nwsapi/src/nwsapi.js:36:14)`
- `Document.readyState` → **C** (Frame resolves inside jsdom/selector/instrumentation internals.)
  - evidence: `at /Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/jsdom/lib/jsdom/browser/Window.js:194:25`
- `Element.getElementsByTagName` → **C** (Frame resolves inside jsdom/selector/instrumentation internals.)
  - evidence: `at byTag (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/nwsapi/src/nwsapi.js:441:39)`
- `Element.matches` → **A** (Frame resolves inside @getodk/xforms-engine runtime code.)
  - evidence: `at <anonymous> (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/@getodk/common/src/lib/dom/compatibility.ts:51:17)`
- `Element.querySelector` → **B** (Frame resolves inside a transitive runtime dependency invoked by ODK runtime.)
  - evidence: `at <anonymous> (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/@getodk/common/src/lib/dom/compatibility.ts:10:12)`
- `NamedNodeMap.length` → **A** (Frame resolves inside @getodk/xpath runtime code.)
  - evidence: `at ProxyHandler.get (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/jsdom/lib/jsdom/living/generated/NamedNodeMap.js:374:22)`
- `Node.childNodes` → **B** (Frame resolves inside a transitive runtime dependency invoked by ODK runtime.)
  - evidence: `at serializeElement (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/w3c-xmlserializer/lib/serialize.js:262:10)`
- `Node.lookupNamespaceURI` → **A** (Frame resolves inside @getodk/xpath runtime code.)
  - evidence: `at Object.resolveWHATNamespaceURI (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/@getodk/xpath/dist/index.js:2918:15)`
- `Node.nodeName` → **A** (Frame resolves inside @getodk/xforms-engine runtime code.)
  - evidence: `at createDefaultInstanceIDBinding (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/@getodk/xforms-engine/src/parse/XFormDOM.ts:99:43)`
- `Node.ownerDocument` → **A** (Frame resolves inside @getodk/xpath runtime code.)
  - evidence: `at switchContext (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/nwsapi/src/nwsapi.js:282:21)`
- `Node.parentElement` → **C** (Frame resolves inside jsdom/selector/instrumentation internals.)
  - evidence: `at Array.Resolver (eval at compile (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/nwsapi/src/nwsapi.js:894:17), <anonymous>:3:119)`
- `Node.textContent` → **A** (Frame resolves inside @getodk/xforms-engine runtime code.)
  - evidence: `at new XFormDefinition (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/@getodk/xforms-engine/src/parse/XFormDefinition.ts:26:24)`
- `NodeList.length` → **A** (Frame resolves inside @getodk/xforms-engine runtime code.)
  - evidence: `at ProxyHandler.get (/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/experiments/m1-dom-contract/node_modules/jsdom/lib/jsdom/living/generated/NodeList.js:175:22)`

## Normalized requirements (M1.1)

### Attr
- `localName` (observed via: Attr, static: yes, dynamic: yes, attribution: -)
- `namespaceURI` (observed via: Attr, static: yes, dynamic: yes, attribution: -)
- `prefix` (observed via: Attr, static: yes, dynamic: yes, attribution: -)
- `value` (observed via: Attr, static: yes, dynamic: yes, attribution: -)

### ChildNode
- `nodeValue` (observed via: ChildNode, static: yes, dynamic: no, attribution: -)

### Document
- `children` (observed via: Document, static: no, dynamic: yes, attribution: A)
- `compatMode` (observed via: Document, static: no, dynamic: yes, attribution: C)
- `contentType` (observed via: Document, static: no, dynamic: yes, attribution: C)
- `createElement` (observed via: Document, static: no, dynamic: yes, attribution: B)
- `createElementNS` (observed via: Document, static: yes, dynamic: yes, attribution: -)
- `currentScript` (observed via: Document, static: no, dynamic: yes, attribution: A)
- `documentElement` (observed via: Document, XMLDocument, static: yes, dynamic: yes, attribution: A)
- `readyState` (observed via: Document, static: no, dynamic: yes, attribution: C)

### DOMParser
- `<constructor>` (observed via: DOMParser, static: yes, dynamic: yes, attribution: -)
- `parseFromString` (observed via: DOMParser, static: yes, dynamic: yes, attribution: -)

### Element
- `append` (observed via: Element, static: yes, dynamic: yes, attribution: -)
- `appendChild` (observed via: HTMLElement, static: yes, dynamic: no, attribution: -)
- `attributes` (observed via: Element, static: yes, dynamic: yes, attribution: -)
- `children` (observed via: Element, HTMLElement, static: yes, dynamic: yes, attribution: -)
- `cloneNode` (observed via: Element, static: yes, dynamic: no, attribution: -)
- `firstChild` (observed via: Element, static: yes, dynamic: no, attribution: -)
- `getAttribute` (observed via: Element, static: yes, dynamic: yes, attribution: -)
- `getAttributeNS` (observed via: Element, static: yes, dynamic: yes, attribution: -)
- `getElementsByTagName` (observed via: Element, static: no, dynamic: yes, attribution: C)
- `hasAttribute` (observed via: Element, static: yes, dynamic: yes, attribution: -)
- `localName` (observed via: Element, static: yes, dynamic: yes, attribution: -)
- `matches` (observed via: Element, static: no, dynamic: yes, attribution: A)
- `namespaceURI` (observed via: Element, static: yes, dynamic: yes, attribution: -)
- `outerHTML` (observed via: Element, HTMLElement, static: yes, dynamic: yes, attribution: -)
- `prefix` (observed via: Element, static: yes, dynamic: yes, attribution: -)
- `prepend` (observed via: Element, static: yes, dynamic: no, attribution: -)
- `querySelector` (observed via: Element, static: no, dynamic: yes, attribution: B)
- `querySelectorAll` (observed via: Element, static: yes, dynamic: yes, attribution: -)
- `remove` (observed via: Element, static: yes, dynamic: no, attribution: -)
- `replaceWith` (observed via: Element, static: yes, dynamic: no, attribution: -)
- `setAttribute` (observed via: Element, HTMLElement, static: yes, dynamic: yes, attribution: -)
- `setAttributeNS` (observed via: Element, static: yes, dynamic: yes, attribution: -)

### NamedNodeMap
- `length` (observed via: NamedNodeMap, static: no, dynamic: yes, attribution: A)

### Node
- `childNodes` (observed via: Element, Node, static: yes, dynamic: yes, attribution: B)
- `data` (observed via: CharacterData, Node, static: yes, dynamic: yes, attribution: -)
- `lookupNamespaceURI` (observed via: Node, static: no, dynamic: yes, attribution: A)
- `lookupPrefix` (observed via: Node, static: yes, dynamic: yes, attribution: -)
- `nodeName` (observed via: Element, Node, static: yes, dynamic: yes, attribution: A)
- `nodeType` (observed via: Attr, ChildNode, Node, static: yes, dynamic: yes, attribution: -)
- `ownerDocument` (observed via: Element, Node, static: yes, dynamic: yes, attribution: A)
- `parentElement` (observed via: Node, static: no, dynamic: yes, attribution: C)
- `textContent` (observed via: Element, HTMLElement, Node, static: yes, dynamic: yes, attribution: A)

### NodeList
- `length` (observed via: NodeList, static: no, dynamic: yes, attribution: A)

### ParentNode
- `firstElementChild` (observed via: ParentNode, static: yes, dynamic: no, attribution: -)
- `lastElementChild` (observed via: ParentNode, static: yes, dynamic: no, attribution: -)

### XMLSerializer
- `<constructor>` (observed via: XMLSerializer, static: yes, dynamic: no, attribution: -)
- `serializeToString` (observed via: XMLSerializer, static: yes, dynamic: no, attribution: -)

