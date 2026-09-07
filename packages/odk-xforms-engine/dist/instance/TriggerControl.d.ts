import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { TextRange } from '../client/TextRange.ts';
import { TriggerNode, TriggerNodeDefinition } from '../client/TriggerNode.ts';
import { XFormsXPathElement } from '../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticLeafElement } from '../integration/xpath/static-dom/StaticElement.ts';
import { TriggerInputValue, TriggerRuntimeValue } from '../lib/codecs/TriggerCodec.ts';
import { AttributeState } from '../lib/reactivity/createAttributeState.ts';
import { CurrentState } from '../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../lib/reactivity/node-state/createSharedNodeState.ts';
import { UnknownAppearanceDefinition } from '../parse/body/appearance/unknownAppearanceParser.ts';
import { Attribute } from './Attribute.ts';
import { Root } from './Root.ts';
import { ValueNode, ValueNodeStateSpec } from './abstract/ValueNode.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { EvaluationContext } from './internal-api/EvaluationContext.ts';
import { ValidationContext } from './internal-api/ValidationContext.ts';
import { ClientReactiveSerializableValueNode } from './internal-api/serialization/ClientReactiveSerializableValueNode.ts';
interface TriggerControlStateSpec extends ValueNodeStateSpec<TriggerRuntimeValue> {
    readonly label: Accessor<TextRange<'label'> | null>;
    readonly hint: Accessor<TextRange<'hint'> | null>;
    readonly valueOptions: null;
}
export declare class TriggerControl extends ValueNode<'string', TriggerNodeDefinition<'string'>, TriggerRuntimeValue, TriggerInputValue> implements TriggerNode, XFormsXPathElement, EvaluationContext, ValidationContext, ClientReactiveSerializableValueNode {
    static from(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: TriggerNodeDefinition): TriggerControl;
    readonly [XPathNodeKindKey] = "element";
    protected readonly state: SharedNodeState<TriggerControlStateSpec>;
    protected readonly engineState: EngineState<TriggerControlStateSpec>;
    readonly attributeState: AttributeState;
    readonly nodeType = "trigger";
    readonly appearances: UnknownAppearanceDefinition;
    readonly nodeOptions: null;
    readonly currentState: CurrentState<TriggerControlStateSpec>;
    private constructor();
    getAttributes(): readonly Attribute[];
    setValue(value: TriggerInputValue): Root;
}
export {};
