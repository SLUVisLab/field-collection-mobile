import { AbsoluteRootLocationPathNode, FilterExprNode, RelativeStepSyntaxLiteralNode, StepNode } from '@getodk/xpath/static/grammar/SyntaxNode.js';
import { PathExpressionNode } from './semantic-analysis.ts';
type AbsolutePathHead = 
/** / - as first character in LocationPath */
AbsoluteRootLocationPathNode
/** // - as first characters in LocationPath */
 | RelativeStepSyntaxLiteralNode;
/**
 * fn(...args) - as first (and potentially only) part of a path expression,
 * where the function is either known to produce a node-set result, or where
 * other aspects of the exression's syntax are inherently node-set producing.
 */
type FilterPathExprHead = FilterExprNode;
type StepLikeNode = 
/** // - shorthand for `/descendant-or-self::node()/`  */
RelativeStepSyntaxLiteralNode
/** Any _actual_ Step in a LocationPath */
 | StepNode;
type PathNodeListHead = AbsolutePathHead | FilterPathExprHead | StepLikeNode;
/**
 * A path node list is a semi-flattened representation of...
 *
 * - Any XPath LocationPath expression:
 *   - AbsoluteLocationPath
 *   - RelativeLocationPath
 *
 * - Any expression beginning with a FilterExpr which is known to produce a
 *   node-set result
 *
 * The flattening of these syntax representations is used to perform various
 * aspects of path resolution logic, accounting for complexities of XPath syntax
 * and semantics in a roughly linear/list processing manner.
 */
export type PathNodeList<Head extends PathNodeListHead = PathNodeListHead> = readonly [
    head: Head,
    ...tail: StepLikeNode[]
];
export declare const resolvePath: (contextNode: PathExpressionNode | null, pathNode: PathExpressionNode) => PathNodeList;
/**
 * Resolves the parsed path {@link predicatePathNode}, in the context of:
 *
 * - The {@link contextNode} context, representing the original expression's
 *   context (if one was available)
 *
 * - The {@link stepContextNodes} context, representing the cumulative portion
 *   of the source path where {@link predicatePathNode} was parsed from a
 *   Predicate sub-expression
 *
 * Both contexts are necessary for resolution to ensure that:
 *
 * - A `current()` call within the predicate's sub-expression is contextualized
 *   to the current `nodeset` reference associated with the original expression
 *
 * - A `.` self-reference within the predicate's sub-expression is
 *   contextualized to the Step in which it occurred
 */
export declare const resolvePredicateReference: (contextNode: PathExpressionNode | null, stepContextNodes: PathNodeList, predicatePathNode: PathExpressionNode) => PathNodeList;
interface PathSerializationOptions {
    /**
     * @default false
     */
    readonly stripPredicates: boolean;
}
/**
 * Serializes a resolved {@link PathNodeList} to its XPath expression
 * representation, optionally stripping predicates.
 */
export declare const serializeNodesetReference: (nodes: PathNodeList, options: PathSerializationOptions) => string;
export {};
