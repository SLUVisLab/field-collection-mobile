import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { RangeInputValue, RangeNode, RangeNodeAppearances, RangeValue } from '../client/RangeNode.ts';
import { TextRange } from '../client/TextRange.ts';
import { XFormsXPathElement } from '../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticLeafElement } from '../integration/xpath/static-dom/StaticElement.ts';
import { AttributeState } from '../lib/reactivity/createAttributeState.ts';
import { CurrentState } from '../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../lib/reactivity/node-state/createSharedNodeState.ts';
import { AnyRangeNodeDefinition, RangeNodeDefinition, RangeValueType } from '../parse/model/RangeNodeDefinition.ts';
import { Attribute } from './Attribute.ts';
import { Root } from './Root.ts';
import { ValueNode, ValueNodeStateSpec } from './abstract/ValueNode.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { EvaluationContext } from './internal-api/EvaluationContext.ts';
import { ValidationContext } from './internal-api/ValidationContext.ts';
import { ClientReactiveSerializableValueNode } from './internal-api/serialization/ClientReactiveSerializableValueNode.ts';
interface RangeControlStateSpec<V extends RangeValueType> extends ValueNodeStateSpec<RangeValue<V>> {
    readonly label: Accessor<TextRange<'label'> | null>;
    readonly hint: Accessor<TextRange<'hint'> | null>;
    readonly valueOptions: null;
}
export declare class RangeControl<V extends RangeValueType = RangeValueType> extends ValueNode<V, RangeNodeDefinition<V>, RangeValue<V>, RangeInputValue<V>> implements RangeNode<V>, XFormsXPathElement, EvaluationContext, ValidationContext, ClientReactiveSerializableValueNode {
    static from(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: AnyRangeNodeDefinition): AnyRangeControl;
    readonly [XPathNodeKindKey] = "element";
    protected readonly state: SharedNodeState<RangeControlStateSpec<V>>;
    protected readonly engineState: EngineState<RangeControlStateSpec<V>>;
    readonly attributeState: AttributeState;
    readonly nodeType = "range";
    readonly appearances: RangeNodeAppearances;
    readonly nodeOptions: null;
    readonly currentState: CurrentState<RangeControlStateSpec<V>>;
    constructor(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: RangeNodeDefinition<V>);
    setValue(value: RangeInputValue<V>): Root;
    getAttributes(): readonly Attribute[];
}
export type AnyRangeControl = RangeControl<'decimal'> | RangeControl<'int'>;
export {};
