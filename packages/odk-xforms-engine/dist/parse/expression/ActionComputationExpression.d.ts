import { DependentExpression, DependentExpressionResultType } from './abstract/DependentExpression.ts';
export declare class ActionComputationExpression<Type extends DependentExpressionResultType> extends DependentExpression<Type> {
    constructor(resultType: Type, expression: string);
}
