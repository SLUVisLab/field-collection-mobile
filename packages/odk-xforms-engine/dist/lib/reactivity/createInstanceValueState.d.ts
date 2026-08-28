import { AttributeContext } from '../../instance/internal-api/AttributeContext.ts';
import { InstanceValueContext } from '../../instance/internal-api/InstanceValueContext.ts';
import { SimpleAtomicState, SimpleAtomicStateSetter } from './types.ts';
type ValueContext = AttributeContext | InstanceValueContext;
export interface InstanceValueState {
    readonly valueState: SimpleAtomicState<string>;
    readonly setValueFromAction: SimpleAtomicStateSetter<string>;
}
/**
 * Provides a consistent interface for value nodes of any type which:
 *
 * - derives initial state from either an existing instance (e.g. for edits) or
 *   the node's definition (e.g. initializing a new instance)
 * - decodes current primary instance state into the value node's runtime type
 * - encodes updated runtime values to store updated instance state
 * - initializes reactive computation of `calculate` bind expressions for those
 *   nodes defined with one
 * - prevents downstream (client/user) writes to nodes in a readonly state,
 *   while still permitting engine-initiated writes to those nodes
 */
export declare const createInstanceValueState: (context: ValueContext) => InstanceValueState;
export {};
