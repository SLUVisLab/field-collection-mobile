import { Accessor } from 'solid-js';
import { EvaluationContext } from '../../instance/internal-api/EvaluationContext.ts';
import { EngineXPathNode } from '../../integration/xpath/adapter/kind.ts';
import { DependentExpression, DependentExpressionResultType } from '../../parse/expression/abstract/DependentExpression.ts';
interface ComputedExpressionResults {
    readonly boolean: boolean;
    readonly nodes: EngineXPathNode[];
    readonly number: number;
    readonly string: string;
}
type EvaluatedExpression<Type extends DependentExpressionResultType> = ComputedExpressionResults[Type];
type ComputedExpression<Type extends DependentExpressionResultType> = Accessor<EvaluatedExpression<Type>>;
interface CreateComputedExpressionOptions<Type extends DependentExpressionResultType> {
    /**
     * If a default value is provided, {@link createComputedExpression} will
     * produce this value for computations in a non-attached evaluation context,
     * i.e. when evaluating an expression against a node which has not yet been
     * appended to its parents children state (or which has since been removed
     * from that state). A non-attached state is detected when
     * {@link EvaluationContext.isAttached} returns false.
     *
     * If no default value is provided, an implicit default value is produced as
     * appropriate for the expression's intrinsic result type.
     *
     * @see {@link defaultEvaluationsByType} for these implicit defaults.
     */
    readonly defaultValue?: EvaluatedExpression<Type>;
}
export declare const createComputedExpression: <Type extends DependentExpressionResultType>(context: EvaluationContext, dependentExpression: DependentExpression<Type>, options?: CreateComputedExpressionOptions<Type>) => ComputedExpression<Type>;
export {};
