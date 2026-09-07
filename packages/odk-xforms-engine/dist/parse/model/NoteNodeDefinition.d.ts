import { ValueType } from '../../client/ValueType.ts';
import { StaticLeafElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { AnyBodyElementDefinition } from '../body/BodyDefinition.ts';
import { InputControlDefinition } from '../body/control/InputControlDefinition.ts';
import { BindComputationExpression } from '../expression/BindComputationExpression.ts';
import { ConstantTruthyDependentExpression } from '../expression/abstract/DependentExpression.ts';
import { HintDefinition } from '../text/HintDefinition.ts';
import { LabelDefinition } from '../text/LabelDefinition.ts';
import { BindDefinition } from './BindDefinition.ts';
import { LeafNodeDefinition } from './LeafNodeDefinition.ts';
import { ModelDefinition } from './ModelDefinition.ts';
import { ParentNodeDefinition } from './NodeDefinition.ts';
export type NoteReadonlyDefinition = BindComputationExpression<'readonly'> & ConstantTruthyDependentExpression;
export interface NoteBindDefinition<V extends ValueType> extends BindDefinition<V> {
    readonly readonly: NoteReadonlyDefinition;
}
export type NoteTextDefinition = LabelDefinition | HintDefinition;
/**
 * @package This class is used internally, both in static types and at runtime,
 * to guard and guide the distinction between instance state nodes for 'note'
 * and 'input' node types. It is intentionally package-private! The less
 * specific {@link NoteNode.definition} type, if it has any client value at all,
 * should be more than sufficient. Clients are otherwise expected to use other
 * aspects of the node's interface (such as its {@link NoteNode.nodeType} and
 * distinct {@link NoteNode.currentState} types) to handle note-specific logic.
 */
export declare class NoteNodeDefinition<V extends ValueType = ValueType> extends LeafNodeDefinition<V> {
    readonly bind: NoteBindDefinition<V>;
    readonly bodyElement: InputControlDefinition;
    readonly noteTextDefinition: NoteTextDefinition;
    static from<V extends ValueType>(model: ModelDefinition, parent: ParentNodeDefinition, bind: BindDefinition<V>, bodyElement: AnyBodyElementDefinition | null, node: StaticLeafElement): NoteNodeDefinition<V> | null;
    constructor(model: ModelDefinition, parent: ParentNodeDefinition, bind: NoteBindDefinition<V>, bodyElement: InputControlDefinition, noteTextDefinition: NoteTextDefinition, template: StaticLeafElement);
}
