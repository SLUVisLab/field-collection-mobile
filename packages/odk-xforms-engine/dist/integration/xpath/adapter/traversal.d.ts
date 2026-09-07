import { EngineXPathAttribute, EngineXPathDocument, EngineXPathElement, EngineXPathNode, XFormsXPathChildNode } from './kind.ts';
export declare const getContainingEngineXPathDocument: (node: EngineXPathNode) => EngineXPathDocument;
export declare const getAttributes: (node: EngineXPathNode) => readonly EngineXPathAttribute[];
/**
 * @todo We've now laid most of the groundwork necessary to implement this
 * properly. At time of writing it has still been deferred because:
 *
 * 1. The scope of changes enabling it is already a fairly large yak shave.
 * 2. It is only used to support XPath LocationPath Steps whose AxisName is
 *    `namespace`. If we _ever_ support this, it would probably be for extremely
 *    niche use cases!
 *
 * @todo Since we've consciously deferred implementing this (twice now!), should
 * it throw? It might be nice to be alerted if the assumptions in point 2 above
 * are somehow wrong (or become wrong).
 */
export declare const getNamespaceDeclarations: () => readonly [];
export declare const getParentNode: (node: EngineXPathNode) => EngineXPathNode | null;
export declare const getChildNodes: (node: EngineXPathNode) => readonly XFormsXPathChildNode[];
export declare const getChildElements: (node: EngineXPathNode) => readonly EngineXPathElement[];
export declare const getPreviousSiblingNode: (node: EngineXPathNode) => XFormsXPathChildNode | null;
export declare const getPreviousSiblingElement: (node: EngineXPathNode) => EngineXPathElement | null;
export declare const getNextSiblingNode: (node: EngineXPathNode) => XFormsXPathChildNode | null;
export declare const getNextSiblingElement: (node: EngineXPathNode) => EngineXPathElement | null;
export declare const isDescendantNode: (ancestor: EngineXPathNode, other: EngineXPathNode) => boolean;
export declare const compareDocumentOrder: () => never;
