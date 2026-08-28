import { Accessor } from 'solid-js';
import { OpaqueReactiveObjectFactory } from '../../../client/OpaqueReactiveObjectFactory.ts';
import { AnyViolation, ConditionValidation, ValidationCondition } from '../../../client/validation.ts';
import { ValidationContext } from '../../../instance/internal-api/ValidationContext.ts';
import { SharedNodeState, SharedNodeStateOptions } from '../node-state/createSharedNodeState.ts';
type ComputedConditionValidation<Condition extends ValidationCondition> = Accessor<ConditionValidation<Condition>>;
type ComputedViolation = Accessor<AnyViolation | null>;
interface ValidationStateSpec {
    readonly constraint: ComputedConditionValidation<'constraint'>;
    readonly required: ComputedConditionValidation<'required'>;
    readonly violation: ComputedViolation;
}
export type SharedValidationState = SharedNodeState<ValidationStateSpec>;
interface ValidationStateOptions<Factory extends OpaqueReactiveObjectFactory> extends SharedNodeStateOptions<Factory, ValidationStateSpec> {
}
export declare const createValidationState: <Factory extends OpaqueReactiveObjectFactory>(context: ValidationContext, options: ValidationStateOptions<Factory>) => SharedValidationState;
export {};
