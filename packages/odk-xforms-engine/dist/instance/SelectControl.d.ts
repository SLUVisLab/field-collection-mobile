import { XPathNodeKindKey, XPathChoiceNode } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { SelectDefinition, SelectItem, SelectNode, SelectNodeAppearances, SelectValueOptions } from '../client/SelectNode.ts';
import { TextRange } from '../client/TextRange.ts';
import { ValueType } from '../client/ValueType.ts';
import { XFormsXPathElement } from '../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticLeafElement } from '../integration/xpath/static-dom/StaticElement.ts';
import { AttributeState } from '../lib/reactivity/createAttributeState.ts';
import { CurrentState } from '../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../lib/reactivity/node-state/createSharedNodeState.ts';
import { SelectType } from '../parse/body/control/SelectControlDefinition.ts';
import { Attribute } from './Attribute.ts';
import { Root } from './Root.ts';
import { ValueNodeStateSpec, ValueNode } from './abstract/ValueNode.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { EvaluationContext } from './internal-api/EvaluationContext.ts';
import { ValidationContext } from './internal-api/ValidationContext.ts';
import { ClientReactiveSerializableValueNode } from './internal-api/serialization/ClientReactiveSerializableValueNode.ts';
export type AnySelectDefinition = {
    [V in ValueType]: SelectDefinition<V>;
}[ValueType];
interface SelectControlStateSpec extends ValueNodeStateSpec<readonly string[]> {
    readonly label: Accessor<TextRange<'label'> | null>;
    readonly hint: Accessor<TextRange<'hint'> | null>;
    readonly valueOptions: Accessor<SelectValueOptions>;
    readonly isSelectWithImages: Accessor<boolean>;
}
export declare class SelectControl extends ValueNode<'string', SelectDefinition<'string'>, readonly string[], readonly string[]> implements SelectNode, XFormsXPathElement, EvaluationContext, ValidationContext, ClientReactiveSerializableValueNode, XPathChoiceNode {
    static from(parent: GeneralParentNode, instanceNode: StaticLeafElement | null, definition: SelectDefinition): SelectControl;
    private readonly mapOptionsByValue;
    protected readonly getInstanceValue: Accessor<string>;
    readonly [XPathNodeKindKey] = "element";
    protected readonly state: SharedNodeState<SelectControlStateSpec>;
    protected readonly engineState: EngineState<SelectControlStateSpec>;
    readonly attributeState: AttributeState;
    readonly nodeType = "select";
    readonly selectType: SelectType;
    readonly appearances: SelectNodeAppearances;
    readonly nodeOptions: null;
    readonly currentState: CurrentState<SelectControlStateSpec>;
    private constructor();
    /**
     * Filters {@link values} to include only those values which are currently
     * available in the mapping produced by {@link mapOptionsByValue}, i.e. within
     * a potentially filtered itemset.
     *
     * Note: this method effectively produces an intersection of
     * {@link sourceValues} and {@link values}. **Importantly**, ordering of the
     * results is deterministic, preserving the order of values as yielded _by
     * {@link sourceValues}_.
     *
     * At time of writing, there are several tests (in `@getodk/scenario`, ported
     * from JavaRosa) which expect the values of a `<select>` to match the order
     * they appear in the control's (potentially filtered) `<itemset>` (or list of
     * `<item>`s, for forms defining those inline).
     *
     * @todo The `<odk:rank>` control, having semantics very similar to
     * `<select>`, will likely perform similar filtering logic. However, one of
     * the important distinctions between these controls is that `<odk:rank>`
     * exists explicitly to control the order of values. It's quite likely that
     * would be achieved by invoking the same logic with the parameter order
     * reversed.
     */
    private filterValues;
    getValueOption(value: string): SelectItem | null;
    isSelected(value: string): boolean;
    selectValue(value: string | null): Root;
    selectValues(values: readonly string[]): Root;
    getChoiceName(value: string): string | null;
    getAttributes(): readonly Attribute[];
}
export {};
