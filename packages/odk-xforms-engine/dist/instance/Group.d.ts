import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { GroupDefinition, GroupNode, GroupNodeAppearances } from '../client/GroupNode.ts';
import { FormNodeID } from '../client/identity.ts';
import { InstanceState } from '../client/serialization/InstanceState.ts';
import { TextRange } from '../client/TextRange.ts';
import { AncestorNodeValidationState } from '../client/validation.ts';
import { XFormsXPathElement } from '../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticElement } from '../integration/xpath/static-dom/StaticElement.ts';
import { AttributeState } from '../lib/reactivity/createAttributeState.ts';
import { MaterializedChildren } from '../lib/reactivity/materializeCurrentStateChildren.ts';
import { CurrentState } from '../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../lib/reactivity/node-state/createSharedNodeState.ts';
import { DescendantNodeSharedStateSpec, DescendantNode } from './abstract/DescendantNode.ts';
import { Attribute } from './Attribute.ts';
import { GeneralChildNode, GeneralParentNode } from './hierarchy.ts';
import { EvaluationContext } from './internal-api/EvaluationContext.ts';
import { ClientReactiveSerializableParentNode } from './internal-api/serialization/ClientReactiveSerializableParentNode.ts';
interface GroupStateSpec extends DescendantNodeSharedStateSpec {
    readonly label: Accessor<TextRange<'label'> | null>;
    readonly hint: null;
    readonly children: Accessor<readonly FormNodeID[]>;
    readonly hasRelevantBodyNodes: Accessor<boolean>;
    readonly attributes: Accessor<readonly Attribute[]>;
    readonly valueOptions: null;
    readonly value: null;
}
export declare class Group extends DescendantNode<GroupDefinition, GroupStateSpec, GeneralParentNode, GeneralChildNode> implements GroupNode, XFormsXPathElement, EvaluationContext, ClientReactiveSerializableParentNode<GeneralChildNode> {
    private readonly childrenState;
    readonly [XPathNodeKindKey] = "element";
    protected readonly state: SharedNodeState<GroupStateSpec>;
    protected engineState: EngineState<GroupStateSpec>;
    readonly attributeState: AttributeState;
    readonly nodeType = "group";
    readonly appearances: GroupNodeAppearances;
    readonly nodeOptions: null;
    readonly currentState: MaterializedChildren<CurrentState<GroupStateSpec>, GeneralChildNode>;
    readonly validationState: AncestorNodeValidationState;
    readonly instanceState: InstanceState;
    constructor(parent: GeneralParentNode, instanceNode: StaticElement | null, definition: GroupDefinition);
    getChildren(): readonly GeneralChildNode[];
    getAttributes(): readonly Attribute[];
}
export {};
