import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor, Signal } from 'solid-js';
import { BaseNode } from '../../client/BaseNode.ts';
import { NodeAppearances } from '../../client/NodeAppearances.ts';
import { FormNodeID } from '../../client/identity.ts';
import { InstanceNodeType as ClientInstanceNodeType } from '../../client/node-types.ts';
import { InstanceState } from '../../client/serialization/InstanceState.ts';
import { NodeValidationState } from '../../client/validation.ts';
import { ActiveLanguage, TextRange } from '../../index.ts';
import { EngineXPathEvaluator } from '../../integration/xpath/EngineXPathEvaluator.ts';
import { XFormsXPathPrimaryInstanceNode, XFormsXPathPrimaryInstanceNodeKind } from '../../integration/xpath/adapter/XFormsXPathNode.ts';
import { PrimaryInstanceXPathNode } from '../../integration/xpath/adapter/kind.ts';
import { StaticAttribute } from '../../integration/xpath/static-dom/StaticAttribute.ts';
import { StaticDocument } from '../../integration/xpath/static-dom/StaticDocument.ts';
import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { CurrentState } from '../../lib/reactivity/node-state/createCurrentState.ts';
import { EngineState } from '../../lib/reactivity/node-state/createEngineState.ts';
import { SharedNodeState } from '../../lib/reactivity/node-state/createSharedNodeState.ts';
import { ReactiveScope } from '../../lib/reactivity/scope.ts';
import { SimpleAtomicState } from '../../lib/reactivity/types.ts';
import { AnyNodeDefinition } from '../../parse/model/NodeDefinition.ts';
import { Attribute } from '../Attribute.ts';
import { PrimaryInstance } from '../PrimaryInstance.ts';
import { Root } from '../Root.ts';
import { AnyChildNode, AnyNode } from '../hierarchy.ts';
import { EvaluationContext } from '../internal-api/EvaluationContext.ts';
import { InstanceConfig } from '../internal-api/InstanceConfig.ts';
export type EngineInstanceNodeType = ClientInstanceNodeType | 'primary-instance';
export interface BaseEngineNode extends Omit<BaseNode, 'nodeType'> {
    readonly nodeType: EngineInstanceNodeType;
}
export type InstanceNodeValueOptionsStateSpec = Accessor<null> | Accessor<readonly unknown[]> | null;
export interface InstanceNodeStateSpec<Value = never> {
    readonly reference: Accessor<string> | string;
    readonly readonly: Accessor<boolean> | boolean;
    readonly relevant: Accessor<boolean> | boolean;
    readonly required: Accessor<boolean> | boolean;
    readonly label: Accessor<TextRange<'label'> | null> | null;
    readonly hint: Accessor<TextRange<'hint'> | null> | null;
    readonly children: Accessor<readonly FormNodeID[]> | null;
    readonly attributes: Accessor<readonly Attribute[]> | null;
    readonly valueOptions: InstanceNodeValueOptionsStateSpec;
    readonly value: Signal<Value> | SimpleAtomicState<Value> | null;
}
type AnyInstanceNode = InstanceNode<AnyNodeDefinition, InstanceNodeStateSpec<any>, AnyNode | null, AnyChildNode | null>;
/**
 * This type has the same effect as {@link MaterializedChildren}, but abstractly
 * handles leaf node types as well.
 */
export type InstanceNodeCurrentState<Spec extends InstanceNodeStateSpec<any>, Child> = CurrentState<Omit<Spec, 'children'>> & {
    readonly children: [Child] extends [null] ? null : null extends Child ? ReadonlyArray<NonNullable<Child>> | null : ReadonlyArray<NonNullable<Child>>;
};
interface ComputableReferenceNode {
    readonly parent: AnyNode | null;
    readonly definition: AnyNodeDefinition;
}
type ComputeInstanceNodeReference = <This extends ComputableReferenceNode>(this: This, parent: This['parent'], definition: This['definition']) => string;
export interface InstanceNodeOptions {
    readonly computeReference?: () => string;
    readonly scope?: ReactiveScope;
}
export declare abstract class InstanceNode<Definition extends AnyNodeDefinition, Spec extends InstanceNodeStateSpec<any>, Parent extends AnyNode | null, Child extends AnyChildNode | null = null> implements BaseEngineNode, XFormsXPathPrimaryInstanceNode, EvaluationContext {
    readonly instanceConfig: InstanceConfig;
    readonly parent: Parent;
    readonly instanceNode: StaticAttribute | StaticDocument | StaticElement | null;
    readonly definition: Definition;
    protected abstract readonly state: SharedNodeState<Spec>;
    protected abstract readonly engineState: EngineState<Spec>;
    abstract readonly [XPathNodeKindKey]: XFormsXPathPrimaryInstanceNodeKind;
    readonly rootDocument: PrimaryInstance;
    abstract readonly root: Root;
    /**
     * @package Exposed on every node type to facilitate inheritance, as well as
     * conditional behavior for value nodes.
     */
    abstract readonly hasReadonlyAncestor: Accessor<boolean>;
    /**
     * @package Exposed on every node type to facilitate inheritance, as well as
     * conditional behavior for value nodes.
     */
    abstract readonly isReadonly: Accessor<boolean>;
    /**
     * @package Exposed on every node type to facilitate inheritance, as well as
     * conditional behavior for value nodes.
     */
    abstract readonly hasNonRelevantAncestor: Accessor<boolean>;
    /**
     * @package Exposed on every node type to facilitate inheritance, as well as
     * conditional behavior for value nodes.
     */
    abstract readonly isRelevant: Accessor<boolean>;
    /**
     * @package Exposed on every node type to facilitate inheritance, as well as
     * conditional behavior for value nodes.
     */
    abstract readonly hasRelevantBodyNodes: Accessor<boolean>;
    readonly nodeId: FormNodeID;
    abstract readonly nodeType: EngineInstanceNodeType;
    abstract readonly appearances: NodeAppearances<Definition>;
    abstract readonly nodeOptions: object | null;
    abstract readonly currentState: InstanceNodeCurrentState<Spec, Child>;
    abstract readonly validationState: NodeValidationState;
    abstract readonly instanceState: InstanceState;
    abstract readonly evaluator: EngineXPathEvaluator;
    abstract readonly getActiveLanguage: Accessor<ActiveLanguage>;
    abstract readonly isAttached: Accessor<boolean>;
    readonly scope: ReactiveScope;
    readonly computeReference: ComputeInstanceNodeReference;
    protected readonly computeChildStepReference: ComputeInstanceNodeReference;
    readonly contextReference: () => string;
    /**
     * Note: it is expected that at least some node subclasses will override this
     * to reflect (or in the case of intermediate abstract base classes, to
     * constrain) their more specific `this` type.
     */
    readonly contextNode: PrimaryInstanceXPathNode;
    constructor(instanceConfig: InstanceConfig, parent: Parent, instanceNode: StaticAttribute | StaticDocument | StaticElement | null, definition: Definition, options?: InstanceNodeOptions);
    /** @package */
    isPrimaryInstance(): this is PrimaryInstance;
    /** @package */
    isRoot(): this is Root;
    /**
     * @package This presently serves a growing variety of internal use cases,
     * where certain behaviors depend on arbitrary traversal from any point in the
     * instance tree, without particular regard for the visited node type. It
     * isn't intended for external traversal or any other means of consuming
     * children by a client. This return type intentionally deviates from one
     * structural expectation, requiring even leaf nodes to return an array
     * (though for those nodes it will always be empty). This affords consistency
     * and efficiency of interface for those internal uses.
     */
    abstract getChildren(this: AnyInstanceNode): readonly AnyChildNode[];
    /**
     * @todo Values as text nodes(?)
     */
    getXPathChildNodes(): readonly AnyChildNode[];
    getXPathValue(): string;
    abstract getAttributes(): readonly Attribute[];
}
export {};
