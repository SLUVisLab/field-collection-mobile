import { TriggerRuntimeValue, TriggerValueType } from '../lib/codecs/TriggerCodec.ts';
import { UnknownAppearanceDefinition } from '../parse/body/appearance/unknownAppearanceParser.ts';
import { TriggerControlDefinition } from '../parse/body/control/TriggerControlDefinition.ts';
import { LeafNodeDefinition } from '../parse/model/LeafNodeDefinition.ts';
import { BaseValueNode, BaseValueNodeState } from './BaseValueNode.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { RootNode } from './RootNode.ts';
import { LeafNodeValidationState } from './validation.ts';
import { ValueType } from './ValueType.ts';
export type TriggerValue = TriggerRuntimeValue;
export interface TriggerNodeState extends BaseValueNodeState<TriggerValue> {
    get children(): null;
    get valueOptions(): null;
    get value(): TriggerValue;
}
export interface TriggerNodeDefinition<V extends ValueType = ValueType> extends LeafNodeDefinition<V> {
    readonly bodyElement: TriggerControlDefinition;
}
export interface TriggerNode extends BaseValueNode<TriggerValueType, TriggerValue> {
    readonly nodeType: 'trigger';
    readonly definition: TriggerNodeDefinition<TriggerValueType>;
    readonly appearances: UnknownAppearanceDefinition;
    readonly nodeOptions: null;
    readonly root: RootNode;
    readonly parent: GeneralParentNode;
    readonly currentState: TriggerNodeState;
    readonly validationState: LeafNodeValidationState;
    setValue(value: boolean): RootNode;
}
