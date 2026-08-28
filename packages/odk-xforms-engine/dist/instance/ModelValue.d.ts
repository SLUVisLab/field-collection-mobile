import { XPathNodeKindKey } from '@getodk/xpath';
import { ModelValueDefinition, ModelValueNode } from '../client/ModelValueNode.ts';
import { ValueType } from '../client/ValueType.ts';
import { XFormsXPathElement } from '../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticLeafElement } from '../integration/xpath/static-dom/StaticElement.ts';
import { RuntimeInputValue, RuntimeValue } from '../lib/codecs/getSharedValueCodec.ts';
import { AttributeState } from '../lib/reactivity/createAttributeState.ts';
import { CurrentState } from '../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../lib/reactivity/node-state/createSharedNodeState.ts';
import { Attribute } from './Attribute.ts';
import { ValueNode, ValueNodeStateSpec } from './abstract/ValueNode.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { EvaluationContext } from './internal-api/EvaluationContext.ts';
import { ValidationContext } from './internal-api/ValidationContext.ts';
import { ClientReactiveSerializableValueNode } from './internal-api/serialization/ClientReactiveSerializableValueNode.ts';
interface ModelValueStateSpec<V extends ValueType> extends ValueNodeStateSpec<RuntimeValue<V>> {
    readonly label: null;
    readonly hint: null;
    readonly valueOptions: null;
}
export declare class ModelValue<V extends ValueType = ValueType> extends ValueNode<V, ModelValueDefinition<V>, RuntimeValue<V>, RuntimeInputValue<V>> implements ModelValueNode<V>, XFormsXPathElement, EvaluationContext, ValidationContext, ClientReactiveSerializableValueNode {
    static from(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: ModelValueDefinition): AnyModelValue;
    readonly [XPathNodeKindKey] = "element";
    protected readonly state: SharedNodeState<ModelValueStateSpec<V>>;
    protected readonly engineState: EngineState<ModelValueStateSpec<V>>;
    readonly attributeState: AttributeState;
    readonly nodeType = "model-value";
    readonly appearances: null;
    readonly nodeOptions: null;
    readonly currentState: CurrentState<ModelValueStateSpec<V>>;
    constructor(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: ModelValueDefinition<V>);
    getAttributes(): readonly Attribute[];
}
export type AnyModelValue = ModelValue<'barcode'> | ModelValue<'binary'> | ModelValue<'boolean'> | ModelValue<'date'> | ModelValue<'dateTime'> | ModelValue<'decimal'> | ModelValue<'geopoint'> | ModelValue<'geoshape'> | ModelValue<'geotrace'> | ModelValue<'int'> | ModelValue<'intent'> | ModelValue<'string'> | ModelValue<'time'>;
export {};
