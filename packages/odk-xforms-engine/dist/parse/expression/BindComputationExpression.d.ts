import { BindDefinition } from '../model/BindDefinition.ts';
import { DependentExpression } from './abstract/DependentExpression.ts';
declare const defaultBindComputationExpressions: {
    readonly calculate: null;
    readonly constraint: "true()";
    readonly readonly: "false()";
    readonly relevant: "true()";
    readonly required: "false()";
    readonly saveIncomplete: "false()";
};
type DefaultBindComputationExpressions = typeof defaultBindComputationExpressions;
export type BindComputationType = keyof DefaultBindComputationExpressions;
type BindComputationFactoryResult<Type extends BindComputationType> = DefaultBindComputationExpressions[Type] extends null ? BindComputationExpression<Type> | null : BindComputationExpression<Type>;
declare const bindComputationResultTypes: {
    readonly calculate: "string";
    readonly constraint: "boolean";
    readonly readonly: "boolean";
    readonly relevant: "boolean";
    readonly required: "boolean";
    readonly saveIncomplete: "boolean";
};
type BindComputationResultTypes = typeof bindComputationResultTypes;
export type BindComputationResultType<Computation extends BindComputationType> = BindComputationResultTypes[Computation];
export declare class BindComputationExpression<Computation extends BindComputationType> extends DependentExpression<BindComputationResultType<Computation>> {
    readonly computation: Computation;
    static forComputation<Type extends BindComputationType>(bind: BindDefinition, computation: Type): BindComputationFactoryResult<Type>;
    readonly isDefaultExpression: boolean;
    protected constructor(computation: Computation, expression: string | null);
}
export {};
