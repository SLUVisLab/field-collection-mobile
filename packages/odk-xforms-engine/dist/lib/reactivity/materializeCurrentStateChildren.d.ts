import { FormNodeID } from '../../client/identity.ts';
import { AnyChildNode } from '../../instance/hierarchy.ts';
import { ChildrenState } from './createChildrenState.ts';
import { ReactiveScope } from './scope.ts';
export interface EncodedParentState {
    readonly children: readonly FormNodeID[];
}
export type MaterializedChildren<BaseState extends EncodedParentState, Child extends AnyChildNode | null> = Omit<BaseState, 'children'> & {
    readonly children: readonly Child[];
};
/**
 * Creates a wrapper proxy around a parent node's {@link CurrentState} to map
 * `children` state, which is written to the node's (internal, synchronized)
 * {@link ClientState} as an array of {@link FormNodeID}s, back to the node
 * objects corresponding to those IDs.
 *
 * @see {@link createChildrenState} for further detail.
 */
export declare const materializeCurrentStateChildren: <Child extends AnyChildNode, ParentState extends EncodedParentState>(scope: ReactiveScope, currentState: ParentState, childrenState: ChildrenState<Child>) => MaterializedChildren<ParentState, Child>;
