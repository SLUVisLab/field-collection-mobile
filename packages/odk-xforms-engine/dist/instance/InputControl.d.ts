import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { InputDefinition, InputNode, InputNodeAppearances, InputNodeInputValue, InputNodeOptions } from '../client/InputNode.ts';
import { TextRange } from '../client/TextRange.ts';
import { ValueType } from '../client/ValueType.ts';
import { XFormsXPathElement } from '../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticLeafElement } from '../integration/xpath/static-dom/StaticElement.ts';
import { RuntimeInputValue, RuntimeValue } from '../lib/codecs/getSharedValueCodec.ts';
import { AttributeState } from '../lib/reactivity/createAttributeState.ts';
import { CurrentState } from '../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../lib/reactivity/node-state/createSharedNodeState.ts';
import { ValueNode, ValueNodeStateSpec } from './abstract/ValueNode.ts';
import { Attribute } from './Attribute.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { EvaluationContext } from './internal-api/EvaluationContext.ts';
import { ClientReactiveSerializableValueNode } from './internal-api/serialization/ClientReactiveSerializableValueNode.ts';
import { ValidationContext } from './internal-api/ValidationContext.ts';
import { Root } from './Root.ts';
export type AnyInputDefinition = {
    [V in ValueType]: InputDefinition<V>;
}[ValueType];
interface InputControlStateSpec<V extends ValueType> extends ValueNodeStateSpec<RuntimeValue<V>> {
    readonly label: Accessor<TextRange<'label'> | null>;
    readonly hint: Accessor<TextRange<'hint'> | null>;
    readonly attributes: Accessor<readonly Attribute[]>;
    readonly valueOptions: null;
}
export declare class InputControl<V extends ValueType = ValueType> extends ValueNode<V, InputDefinition<V>, RuntimeValue<V>, RuntimeInputValue<V>> implements InputNode<V>, XFormsXPathElement, EvaluationContext, ValidationContext, ClientReactiveSerializableValueNode {
    static from(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: InputDefinition): AnyInputControl;
    readonly [XPathNodeKindKey] = "element";
    protected readonly state: SharedNodeState<InputControlStateSpec<V>>;
    protected readonly engineState: EngineState<InputControlStateSpec<V>>;
    readonly attributeState: AttributeState;
    readonly nodeType = "input";
    readonly appearances: InputNodeAppearances;
    readonly nodeOptions: InputNodeOptions<V>;
    readonly currentState: CurrentState<InputControlStateSpec<V>>;
    constructor(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: InputDefinition<V>);
    setValue(value: InputNodeInputValue<V>): Root;
    getAttributes(): readonly Attribute[];
}
export type AnyInputControl = InputControl<'barcode'> | InputControl<'binary'> | InputControl<'boolean'> | InputControl<'date'> | InputControl<'dateTime'> | InputControl<'decimal'> | InputControl<'geopoint'> | InputControl<'geoshape'> | InputControl<'geotrace'> | InputControl<'int'> | InputControl<'intent'> | InputControl<'string'> | InputControl<'time'>;
export {};
