import { AbsoluteLocationPathNode, AnySyntaxNode, FilterPathExprNode, RelativeLocationPathNode } from '@getodk/xpath/static/grammar/SyntaxNode.js';
type LocalNameLiteral<LocalName extends string> = LocalName | `${string}:${LocalName}`;
type LocalNamedFunctionCallLiteral<LocalName extends string> = `${LocalNameLiteral<LocalName>}(${string})`;
export type TranslationExpression = LocalNamedFunctionCallLiteral<'itext'>;
/**
 * Determines if an arbitrary XPath expression is (in whole) a translation
 * expression (i.e. a call to `jr:itext`).
 *
 * @todo We may also want a companion function: `hasTranslationExpression`,
 * which could be used for `<label ref>`/`<hint ref>` or anywhere else that an
 * arbitrary expression may call `jr:itext`.
 */
export declare const isTranslationExpression: (expression: string) => expression is TranslationExpression;
export declare const getTranslationExpression: (expression: string) => string | null;
/**
 * Predicate to determine if a FilterPathExpr (as currently produced by
 * `tree-sitter-xpath`) is one of:
 *
 * - `current()`
 * - `current()/...` (where `...` represents additional steps)
 * - `current()//...` (^)
 *
 * @todo XPath grammar technically also allows for FilterExpr[Predicate],
 * and our `tree-sitter-xpath` grammar/parser also allow for this. But
 * `@getodk/xpath` types do not currently acknowledge this possibility.
 */
export declare const isCurrentPath: (syntaxNode: FilterPathExprNode) => boolean;
declare const FILTER_PATH_NODE: unique symbol;
/**
 * Used to narrow types where a SyntaxNode with type 'filter_path_expr' is not
 * **known to produce** a node-set result.
 *
 * This addresses some awkwardness in the XPath grammar (and our implementation
 * parsing it) where FilterExpr _may be_ a FunctionCall, and one of the
 * following _may also be true_:
 *
 * - The function call is known by name to produce a node-set result, **OR**
 *
 * - The function call is followed by one or more Steps (or the Step-like '//'
 *   shorthand), which must produce a node-set **OR**
 *
 * - The function call is followed by one or more Predicates, which must produce
 *   a node-set
 *
 * Any other FilterExpr (and thus our containing synthetic 'filter_path_expr'
 * SyntaxNode) is treated as a non-path [sub-]expression, excluding it from
 * analysis as such (and any downstream logic such as nodeset resolution).
 */
export interface FilterPathNode extends FilterPathExprNode {
    readonly [FILTER_PATH_NODE]: true;
}
/**
 * Determines whether a given expression beginning with a FilterExpr is known to
 * produce a node-set result. Used in downstream dependency analysis, as well as
 * path resolution.
 */
export declare const isNodeSetFilterPathExpression: (syntaxNode: FilterPathExprNode) => syntaxNode is FilterPathNode;
export type PathExpressionNode = AbsoluteLocationPathNode | FilterPathNode | RelativeLocationPathNode;
/**
 * Locates sub-expression {@link PathExpressionNode}s within a parsed XPath
 * expression (or any arbitrary sub-expression thereof).
 */
export declare const findLocationPathSubExpressionNodes: (syntaxNode: AnySyntaxNode) => readonly PathExpressionNode[];
/**
 * Gets the parsed representation of an XPath path expression, iff the complete
 * expression is any {@link PathExpressionNode} syntax type.
 */
export declare const getPathExpressionNode: (expression: string) => PathExpressionNode | null;
type BrandedExpression<Expression extends string, Brand extends symbol> = Expression & Readonly<Record<Brand, true>>;
declare const CONSTANT_EXPRESSION: unique symbol;
type CONSTANT_EXPRESSION = typeof CONSTANT_EXPRESSION;
/**
 * Represents an expression which produces a constant result:
 *
 * - Makes no reference to explicit dependencies
 * - Does not depend on any known, implicit state
 * - Evaluation does not depend in any way on context
 * - Evaluation can be treated as referentially transparent
 */
export type ConstantExpression = BrandedExpression<string, CONSTANT_EXPRESSION>;
/**
 * @see {@link ConstantExpression}
 */
export declare const isConstantExpression: (expression: string) => expression is ConstantExpression;
declare const CONSTANT_TRUTHY_EXPRESSION: unique symbol;
type CONSTANT_TRUTHY_EXPRESSION = typeof CONSTANT_TRUTHY_EXPRESSION;
/**
 * Represents an expression which is {@link ConstantExpression | constant},
 * and which will always produce `true` when evaluated as a boolean.
 */
export type ConstantTruthyExpression = BrandedExpression<ConstantExpression, CONSTANT_TRUTHY_EXPRESSION>;
/**
 * @see {@link ConstantTruthyExpression}
 */
export declare const isConstantTruthyExpression: (expression: string) => expression is ConstantTruthyExpression;
interface QualifiedNameExpression {
    readonly prefix: string;
    readonly localPart: string;
}
export declare const parseQualifiedNameExpression: (expression: string) => QualifiedNameExpression | null;
export {};
