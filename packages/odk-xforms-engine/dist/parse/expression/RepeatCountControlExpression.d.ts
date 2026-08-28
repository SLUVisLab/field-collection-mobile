import { RepeatElementDefinition } from '../body/RepeatElementDefinition.ts';
import { DependentExpression } from './abstract/DependentExpression.ts';
/**
 * Represents either of these
 * {@link https://getodk.github.io/xforms-spec/#body-attributes | body attributes}:
 *
 * - `jr:count`
 * - `jr:noAddRemove`
 *
 * In both cases, the downstream effect is that the engine is responsible for
 * controlling the count of a repeat range's instances. Representing both cases
 * should simplify client usage, as well as implementation of the internal
 * representation of {@link RepeatRangeControlledNode}.
 */
export declare class RepeatCountControlExpression extends DependentExpression<'number'> {
    static from(bodyElement: RepeatElementDefinition, initialCount: number): RepeatCountControlExpression | null;
    private constructor();
}
