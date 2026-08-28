import { EngineXPathEvaluator } from '../../../integration/xpath/EngineXPathEvaluator.ts';
import { ConstantExpression, ConstantTruthyExpression } from '../../xpath/semantic-analysis.ts';
declare const evaluatorMethodsByResultType: {
    readonly boolean: "evaluateBoolean";
    readonly nodes: "evaluateNodes";
    readonly number: "evaluateNumber";
    readonly string: "evaluateString";
};
type EvaluatorMethodsByResultType = typeof evaluatorMethodsByResultType;
export type DependentExpressionResultType = keyof EvaluatorMethodsByResultType;
export type DependentExpressionEvaluatorMethod<Type extends DependentExpressionResultType> = EvaluatorMethodsByResultType[Type];
export type DependentExpressionResult<Type extends DependentExpressionResultType> = ReturnType<EngineXPathEvaluator[DependentExpressionEvaluatorMethod<Type>]>;
export interface ConstantDependentExpression<Type extends DependentExpressionResultType> extends DependentExpression<Type> {
    readonly expression: ConstantExpression;
}
export interface ConstantTruthyDependentExpression extends ConstantDependentExpression<'boolean'> {
    readonly expression: ConstantTruthyExpression;
}
export declare abstract class DependentExpression<Type extends DependentExpressionResultType> {
    readonly resultType: Type;
    readonly expression: string;
    readonly isTranslated: boolean;
    readonly evaluatorMethod: DependentExpressionEvaluatorMethod<Type>;
    readonly constantExpression: ConstantExpression | null;
    readonly constantTruthyExpression: ConstantTruthyExpression | null;
    constructor(resultType: Type, expression: string);
    isConstantExpression(): this is ConstantDependentExpression<Type>;
    isConstantTruthyExpression(): this is ConstantTruthyDependentExpression;
    toString(): string | null;
}
export type AnyDependentExpression = DependentExpression<any>;
export {};
