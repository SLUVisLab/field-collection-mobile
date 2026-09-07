import { Accessor, Setter, Signal } from 'solid-js';
import { FormNodeID } from '../../client/identity.ts';
import { AnyChildNode, AnyParentNode } from '../../instance/hierarchy.ts';
export interface ChildrenState<Child extends AnyChildNode> {
    readonly children: Signal<readonly Child[]>;
    readonly getChildren: Accessor<readonly Child[]>;
    readonly setChildren: Setter<readonly Child[]>;
    readonly childIds: Accessor<readonly FormNodeID[]>;
}
/**
 * Creates a synchronized pair of:
 *
 * - Internal children state suitable for all parent node types
 * - The same children state computed as an array of each child's
 *   {@link FormNodeID}
 *
 * This state is used, in tandem with {@link materializeCurrentStateChildren},
 * to ensure children in **client-facing** state are not written into nested
 * {@link OpaqueReactiveObjectFactory} calls.
 *
 * The produced {@link ChildrenState.children} (and its get/set convenience
 * methods) signal is intended to be used to store the engine's children state,
 * and update that state when appropriate (when appending children of any parent
 * node during form initialization, and when appending repeat instances and
 * their descendants subsequently during a form session).
 *
 * The produced {@link ChildrenState.childIds} memo is intended to be used to
 * specify each parent node's `children` in an instance of {@link EngineState}.
 * In so doing, the node's corresponding (internal, synchronized)
 * {@link ClientState} will likewise store only the children's
 * {@link FormNodeID}s.
 *
 * As a client reacts to changes in a given parent node's `children` state, that
 * node's {@link CurrentState} should produce the child nodes corresponding to
 * those {@link FormNodeID}s with the aforementioned
 * {@link materializeCurrentStateChildren}.
 */
export declare const createChildrenState: <Parent extends AnyParentNode, Child extends AnyChildNode>(parent: Parent) => ChildrenState<Child>;
