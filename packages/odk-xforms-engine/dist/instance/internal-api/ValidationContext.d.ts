import { FormNodeID } from '../../client/identity.ts';
import { AnyViolation } from '../../client/validation.ts';
import { BindComputationExpression } from '../../parse/expression/BindComputationExpression.ts';
import { MessageDefinition } from '../../parse/text/MessageDefinition.ts';
import { EvaluationContext } from './EvaluationContext.ts';
interface ValidationContextCurrentState {
    get reference(): string;
}
interface ValidationContextDefinitionBind {
    readonly constraint: BindComputationExpression<'constraint'>;
    readonly constraintMsg: MessageDefinition<'constraintMsg'> | null;
    readonly required: BindComputationExpression<'required'>;
    readonly requiredMsg: MessageDefinition<'requiredMsg'> | null;
}
interface ValidationContextDefinition {
    readonly bind: ValidationContextDefinitionBind;
}
export interface ValidationContext extends EvaluationContext {
    readonly nodeId: FormNodeID;
    readonly definition: ValidationContextDefinition;
    readonly currentState: ValidationContextCurrentState;
    getViolation(): AnyViolation | null;
    isRelevant(): boolean;
    isRequired(): boolean;
    isBlank(): boolean;
}
export {};
