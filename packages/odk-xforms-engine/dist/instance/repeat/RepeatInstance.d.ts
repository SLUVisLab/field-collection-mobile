import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { FormNodeID } from '../../client/identity.ts';
import { AnyRepeatDefinition, RepeatInstanceNode, RepeatInstanceNodeAppearances } from '../../client/repeat/RepeatInstanceNode.ts';
import { InstanceState } from '../../client/serialization/InstanceState.ts';
import { TextRange } from '../../client/TextRange.ts';
import { AncestorNodeValidationState } from '../../client/validation.ts';
import { XFormsXPathElement } from '../../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { MaterializedChildren } from '../../lib/reactivity/materializeCurrentStateChildren.ts';
import { CurrentState } from '../../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../../lib/reactivity/node-state/createSharedNodeState.ts';
import { DescendantNodeSharedStateSpec, DescendantNode } from '../abstract/DescendantNode.ts';
import { Attribute } from '../Attribute.ts';
import { GeneralChildNode, RepeatRange } from '../hierarchy.ts';
import { EvaluationContext } from '../internal-api/EvaluationContext.ts';
import { ClientReactiveSerializableTemplatedNode } from '../internal-api/serialization/ClientReactiveSerializableTemplatedNode.ts';
interface RepeatInstanceStateSpec extends DescendantNodeSharedStateSpec {
    readonly label: Accessor<TextRange<'label'> | null>;
    readonly hint: null;
    readonly attributes: Accessor<readonly Attribute[]>;
    readonly children: Accessor<readonly FormNodeID[]>;
    readonly hasRelevantBodyNodes: Accessor<boolean>;
    readonly valueOptions: null;
    readonly value: null;
}
interface RepeatInstanceOptions {
    readonly precedingInstance: RepeatInstance | null;
}
export declare class RepeatInstance extends DescendantNode<AnyRepeatDefinition, RepeatInstanceStateSpec, RepeatRange, GeneralChildNode> implements RepeatInstanceNode, XFormsXPathElement, EvaluationContext, ClientReactiveSerializableTemplatedNode {
    readonly parent: RepeatRange;
    private readonly childrenState;
    private readonly attributeState;
    private readonly currentIndex;
    readonly [XPathNodeKindKey] = "element";
    protected readonly state: SharedNodeState<RepeatInstanceStateSpec>;
    protected readonly engineState: EngineState<RepeatInstanceStateSpec>;
    /**
     * @todo Should we special case repeat `readonly` inheritance the same way
     * we do for `relevant`?
     *
     * @see {@link hasNonRelevantAncestor}
     */
    readonly hasReadonlyAncestor: Accessor<boolean>;
    /**
     * A repeat instance can inherit non-relevance, just like any other node. That
     * inheritance is derived from the repeat instance's parent node in the
     * primary instance XML/DOM tree (and would be semantically expected to do so
     * even if we move away from that implementation detail).
     *
     * Since {@link RepeatInstance.parent} is a {@link RepeatRange}, which is a
     * runtime data model fiction that does not exist in that hierarchy, we pass
     * this call through, allowing the {@link RepeatRange} to check the actual
     * primary instance parent node's relevance state.
     *
     * @todo Should we apply similar reasoning in {@link hasReadonlyAncestor}?
     */
    readonly hasNonRelevantAncestor: Accessor<boolean>;
    readonly nodeType = "repeat-instance";
    /**
     * @see {@link RepeatRange.appearances}
     */
    readonly appearances: RepeatInstanceNodeAppearances;
    readonly nodeOptions: null;
    readonly currentState: MaterializedChildren<CurrentState<RepeatInstanceStateSpec>, GeneralChildNode>;
    readonly validationState: AncestorNodeValidationState;
    readonly instanceState: InstanceState;
    constructor(parent: RepeatRange, instanceNode: StaticElement | null, options: RepeatInstanceOptions);
    getChildren(): readonly GeneralChildNode[];
    getAttributes(): readonly Attribute[];
}
export {};
