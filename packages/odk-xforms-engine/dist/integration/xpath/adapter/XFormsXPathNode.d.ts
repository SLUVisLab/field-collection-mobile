import { XPathAttributeKind, XPathCommentKind, XPathDocumentKind, XPathElementKind, XPathTextKind, XPathNodeKindKey } from '@getodk/xpath';
declare const XFORMS_XPATH_NODE_RANGE_BRAND: unique symbol;
/**
 * To be used with any engine representation of a "range" of contiguous child
 * nodes (also somewhat analogous to a DOM "fragment"). This mapping is
 * conceptually disjoint, but serves an important purpose:
 *
 * - While such a "range" may increase the hierarchical depth of an
 *   engine-internal representation, it **DOES NOT** contribute the same
 *   hierarchy in XPath evaluation semantics.
 * - Such a "range" may be treated as a distinct context node for evaluating an
 *   expression. This most cleanly maps to XPath's comment semantics in that it
 *   allows the "range" to have a clear document position (hierarchically a
 *   child of its parent element; sequentially a sibling to that parent's other
 *   child nodes).
 *
 * (Note: while this is phrased as an abstract concept, it is intended to
 * correspond directly to the engine's "repeat range" concept. The specific type
 * is not referenced here because they have an inverse relationship in the
 * module/type graph.)
 */
export type XFormsXPathNodeRangeKind = 'comment' & {
    readonly [XFORMS_XPATH_NODE_RANGE_BRAND]: true;
};
export declare const XFORMS_XPATH_NODE_RANGE_KIND: XFormsXPathNodeRangeKind;
export type XFormsXPathNodeKind = XPathDocumentKind | XFormsXPathNodeRangeKind | XPathElementKind | XPathAttributeKind | XPathTextKind | XPathCommentKind;
export interface XFormsXPathNode {
    readonly [XPathNodeKindKey]: XFormsXPathNodeKind;
    readonly rootDocument: XFormsXPathDocument;
    readonly root: XFormsXPathElement;
    getXPathChildNodes(this: XFormsXPathNode): readonly XFormsXPathDescendantNode[];
    getXPathValue(this: XFormsXPathNode): string;
}
export interface XFormsXPathDocument extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XPathDocumentKind;
}
export interface XFormsXPathElement extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XPathElementKind;
}
/**
 * @see {@link XFormsXPathNodeRangeKind}
 */
export interface XFormsXPathNodeRange extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XFormsXPathNodeRangeKind;
}
export interface XFormsXPathAttribute extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XPathAttributeKind;
}
export interface XFormsXPathText extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XPathTextKind;
}
export interface XFormsXPathComment extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XPathCommentKind;
}
export type XPathNamedNodeKind = XPathElementKind | XPathAttributeKind;
export interface XFormsXPathNamedNode extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XPathNamedNodeKind;
}
export type XFormsXPathDescendantNodeKind = XFormsXPathNodeRangeKind | XPathElementKind | XPathTextKind | XPathCommentKind | XPathAttributeKind;
export interface XFormsXPathDescendantNode extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XFormsXPathDescendantNodeKind;
}
export type XFormsXPathPrimaryInstanceNodeKind = XPathDocumentKind | XFormsXPathNodeRangeKind | XPathElementKind | XPathAttributeKind | XPathTextKind;
export interface XFormsXPathPrimaryInstanceNode extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XFormsXPathPrimaryInstanceNodeKind;
}
export type XFormsXPathPrimaryInstanceDescendantNodeKind = XFormsXPathNodeRangeKind | XPathAttributeKind | XPathElementKind | XPathTextKind;
export interface XFormsXPathPrimaryInstanceDescendantNode extends XFormsXPathNode {
    readonly [XPathNodeKindKey]: XFormsXPathPrimaryInstanceDescendantNodeKind;
}
export {};
