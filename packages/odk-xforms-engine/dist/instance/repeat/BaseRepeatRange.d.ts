import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { FormNodeID } from '../../client/identity.ts';
import { AnyRepeatDefinition } from '../../client/index.ts';
import { NodeAppearances } from '../../client/NodeAppearances.ts';
import { BaseRepeatRangeNode } from '../../client/repeat/BaseRepeatRangeNode.ts';
import { InstanceState } from '../../client/serialization/InstanceState.ts';
import { TextRange } from '../../client/TextRange.ts';
import { AncestorNodeValidationState } from '../../client/validation.ts';
import { XFormsXPathNodeRange, XFormsXPathNodeRangeKind } from '../../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { AttributeState } from '../../lib/reactivity/createAttributeState.ts';
import { ChildrenState } from '../../lib/reactivity/createChildrenState.ts';
import { MaterializedChildren } from '../../lib/reactivity/materializeCurrentStateChildren.ts';
import { CurrentState } from '../../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../../lib/reactivity/node-state/createSharedNodeState.ts';
import { ControlledRepeatDefinition } from '../../parse/model/RepeatDefinition.ts';
import { DescendantNodeSharedStateSpec, DescendantNode } from '../abstract/DescendantNode.ts';
import { Attribute } from '../Attribute.ts';
import { GeneralParentNode } from '../hierarchy.ts';
import { EvaluationContext } from '../internal-api/EvaluationContext.ts';
import { ClientReactiveSerializableParentNode } from '../internal-api/serialization/ClientReactiveSerializableParentNode.ts';
import { RepeatInstance } from './RepeatInstance.ts';
interface RepeatRangeStateSpec extends DescendantNodeSharedStateSpec {
    readonly hint: null;
    readonly label: Accessor<TextRange<'label'> | null>;
    readonly children: Accessor<readonly FormNodeID[]>;
    readonly hasRelevantBodyNodes: Accessor<boolean>;
    readonly attributes: Accessor<readonly Attribute[]>;
    readonly valueOptions: null;
    readonly value: null;
}
type BaseRepeatRangeNodeType<Definition extends AnyRepeatDefinition> = Definition extends ControlledRepeatDefinition ? 'repeat-range:controlled' : 'repeat-range:uncontrolled';
export declare abstract class BaseRepeatRange<Definition extends AnyRepeatDefinition> extends DescendantNode<Definition, RepeatRangeStateSpec, GeneralParentNode, RepeatInstance> implements BaseRepeatRangeNode, XFormsXPathNodeRange, EvaluationContext, ClientReactiveSerializableParentNode<RepeatInstance> {
    protected readonly childrenState: ChildrenState<RepeatInstance>;
    protected readonly attributeState: AttributeState;
    /**
     * A repeat range doesn't have a corresponding primary instance element of its
     * own. It is represented in the following ways:
     *
     * - As a comment node (in terms of XPath semantics), immediately preceding
     *   the repeat range's {@link RepeatInstance | repeat instances} (if it
     *   presently has any; as a placeholder where they may be appended
     *   otherwise). This is necessary to support certain ODK XForms functionality
     *   where an expression is expected to be evaluated against "repeats" as a
     *   conceptual unit. Most typically, this includes:
     *
     *   - `jr:count` expressions associated with the repeat's body element
     *   - `relevant` bind computations associated with the repeat's nodeset
     *
     * - As a subtree with {@link RepeatInstance | repeat instance} **children**,
     *   in service of the client-facing {@link RepeatRangeNode} API (and with the
     *   same structural semantics internally)
     *
     * Ultimately, this means there is a fundamental impedance mismatch between
     * two representations which are either necessary (XPath) or high value
     * (providing a coherent mental model for clients and the engine
     * implementation servicing that client-facing model).
     *
     * In recognition that this is a truly odd mix of inherent and incidental
     * complexity, here we use the special {@link XFormsXPathNodeRangeKind}
     * branded type as a dedicated point of (internal) documentation where the two
     * models diverge.
     */
    readonly [XPathNodeKindKey]: XFormsXPathNodeRangeKind;
    protected readonly state: SharedNodeState<RepeatRangeStateSpec>;
    protected readonly engineState: EngineState<RepeatRangeStateSpec>;
    /**
     * @todo Should we special case repeat `readonly` state the same way
     * we do for `relevant`?
     *
     * @see {@link isSelfRelevant}
     */
    isSelfReadonly: Accessor<boolean>;
    abstract readonly nodeType: BaseRepeatRangeNodeType<Definition>;
    /**
     * @todo RepeatRange*, RepeatInstance* (and RepeatTemplate*) all share the
     * same body element, and thus all share the same definition `bodyElement`. As
     * such, they also all share the same `appearances`. At time of writing,
     * `web-forms` (Vue UI package) treats a `RepeatRangeNode`...
     *
     * - ... as a group, if the node has a label (i.e.
     *   `<group><label/><repeat/></group>`)
     * - ... effectively as a fragment containing only its instances, otherwise
     *
     * We now collapse `<group><repeat>` into `<repeat>`, and no longer treat
     * "repeat group" as a concept (after parsing). According to the spec, these
     * appearances **are supposed to** come from that "repeat group" in the form
     * definition. In practice, many forms do define appearances directly on a
     * repeat element. The engine currently produces an error if both are defined
     * simultaneously, but otherwise makes no distinction between appearances in
     * these form definition shapes:
     *
     * ```xml
     * <group ref="/data/rep1" appearance="...">
     *   <repeat nodeset="/data/rep1"/>
     * </group>
     *
     * <group ref="/data/rep1">
     *   <repeat nodeset="/data/rep1"/ appearance="...">
     * </group>
     *
     * <repeat nodeset="/data/rep1"/ appearance="...">
     * ```
     *
     * All of the above creates considerable ambiguity about where "repeat
     * appearances" should apply, under which circumstances.
     */
    abstract readonly appearances: NodeAppearances<Definition>;
    readonly nodeOptions: null;
    readonly currentState: MaterializedChildren<CurrentState<RepeatRangeStateSpec>, RepeatInstance>;
    abstract readonly validationState: AncestorNodeValidationState;
    readonly instanceState: InstanceState;
    constructor(parent: GeneralParentNode, definition: Definition);
    protected getLastIndex(): number;
    getInstanceIndex(instance: RepeatInstance): number;
    private createChildren;
    protected addChildren(instanceNodes: readonly StaticElement[], afterIndex?: number): readonly RepeatInstance[];
    protected removeChildren(startIndex: number, count: number): readonly RepeatInstance[];
    getChildren(): readonly RepeatInstance[];
    getAttributes(): readonly Attribute[];
}
export {};
