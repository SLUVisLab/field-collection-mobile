import { XPathNodeKindKey, XPathChoiceNode } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { RankDefinition, RankNode, RankValueOptions } from '../client/RankNode.ts';
import { TextRange } from '../client/TextRange.ts';
import { ValueType } from '../client/ValueType.ts';
import { XFormsXPathElement } from '../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticLeafElement } from '../integration/xpath/static-dom/StaticElement.ts';
import { AttributeState } from '../lib/reactivity/createAttributeState.ts';
import { CurrentState } from '../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../lib/reactivity/node-state/createSharedNodeState.ts';
import { UnknownAppearanceDefinition } from '../parse/body/appearance/unknownAppearanceParser.ts';
import { Attribute } from './Attribute.ts';
import { Root } from './Root.ts';
import { ValueNodeStateSpec, ValueNode } from './abstract/ValueNode.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { EvaluationContext } from './internal-api/EvaluationContext.ts';
import { ValidationContext } from './internal-api/ValidationContext.ts';
import { ClientReactiveSerializableValueNode } from './internal-api/serialization/ClientReactiveSerializableValueNode.ts';
export type AnyRankDefinition = {
    [V in ValueType]: RankDefinition<V>;
}[ValueType];
interface RankControlStateSpec extends ValueNodeStateSpec<readonly string[]> {
    readonly label: Accessor<TextRange<'label'> | null>;
    readonly hint: Accessor<TextRange<'hint'> | null>;
    readonly valueOptions: Accessor<RankValueOptions>;
}
export declare class RankControl extends ValueNode<'string', RankDefinition<'string'>, readonly string[], readonly string[]> implements RankNode, XFormsXPathElement, EvaluationContext, ValidationContext, ClientReactiveSerializableValueNode, XPathChoiceNode {
    static from(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: RankDefinition): RankControl;
    private readonly mapOptionsByValue;
    protected readonly getInstanceValue: Accessor<string>;
    readonly [XPathNodeKindKey] = "element";
    protected readonly state: SharedNodeState<RankControlStateSpec>;
    protected readonly engineState: EngineState<RankControlStateSpec>;
    readonly attributeState: AttributeState;
    readonly nodeType = "rank";
    readonly appearances: UnknownAppearanceDefinition;
    readonly nodeOptions: null;
    readonly currentState: CurrentState<RankControlStateSpec>;
    private constructor();
    getAttributes(): readonly Attribute[];
    getValueLabel(value: string): TextRange<'item-label'> | null;
    setValues(valuesInOrder: readonly string[]): Root;
    getChoiceName(value: string): string | null;
}
export {};
