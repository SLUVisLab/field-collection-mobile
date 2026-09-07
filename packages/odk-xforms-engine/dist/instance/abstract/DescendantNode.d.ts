import { XPathNodeKindKey } from '@getodk/xpath';
import { Accessor } from 'solid-js';
import { BaseNode } from '../../client/BaseNode.ts';
import { ActiveLanguage } from '../../client/FormLanguage.ts';
import { InstanceNodeType } from '../../client/node-types.ts';
import { PrimaryInstanceXPathChildNode } from '../../integration/xpath/adapter/kind.ts';
import { XFormsXPathPrimaryInstanceDescendantNode, XFormsXPathPrimaryInstanceDescendantNodeKind } from '../../integration/xpath/adapter/XFormsXPathNode.ts';
import { EngineXPathEvaluator } from '../../integration/xpath/EngineXPathEvaluator.ts';
import { StaticAttribute } from '../../integration/xpath/static-dom/StaticAttribute.ts';
import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { AnyNodeDefinition } from '../../parse/model/NodeDefinition.ts';
import { AnyChildNode, AnyNode } from '../hierarchy.ts';
import { EvaluationContext } from '../internal-api/EvaluationContext.ts';
import { Root } from '../Root.ts';
import { InstanceNodeStateSpec, InstanceNode } from './InstanceNode.ts';
import { ActionDefinition } from '../../parse/model/ActionDefinition.ts';
export interface DescendantNodeSharedStateSpec {
    readonly reference: Accessor<string>;
    readonly readonly: Accessor<boolean>;
    readonly relevant: Accessor<boolean>;
    readonly required: Accessor<boolean>;
}
export type DescendantNodeStateSpec<Value = never> = InstanceNodeStateSpec<Value> & DescendantNodeSharedStateSpec;
export type DescendantNodeDefinition = AnyNodeDefinition;
export type AnyDescendantNode = DescendantNode<DescendantNodeDefinition, DescendantNodeStateSpec<any>, AnyNode, AnyChildNode | null>;
interface DescendantNodeOptions {
    readonly computeReference?: Accessor<string>;
}
/**
 * @todo Unify constructor signatures of {@link DescendantNode} and its
 * subclasses, which will simplify the branchy logic of child node construction
 * and minimize internal churn as common themes evolve. A good starting point is
 * beginning to form in {@link DescendantNodeInitOptions} (not to be confused
 * with the current module-local {@link DescendantNodeOptions}).
 */
export declare abstract class DescendantNode<Definition extends DescendantNodeDefinition, Spec extends DescendantNodeStateSpec<any>, Parent extends AnyNode, Child extends AnyChildNode | null = null> extends InstanceNode<Definition, Spec, Parent, Child> implements BaseNode, XFormsXPathPrimaryInstanceDescendantNode, EvaluationContext {
    readonly parent: Parent;
    readonly instanceNode: StaticAttribute | StaticElement | null;
    readonly definition: Definition;
    /**
     * Partial implementation of {@link isAttached}, used to check whether `this`
     * is present in {@link parent}'s children state.
     */
    protected readonly isAttachedDescendant: Accessor<boolean>;
    readonly hasReadonlyAncestor: Accessor<boolean>;
    readonly isSelfReadonly: Accessor<boolean>;
    readonly isReadonly: Accessor<boolean>;
    readonly hasNonRelevantAncestor: Accessor<boolean>;
    readonly isSelfRelevant: Accessor<boolean>;
    readonly isRelevant: Accessor<boolean>;
    readonly hasRelevantBodyNodes: Accessor<boolean>;
    readonly isRequired: Accessor<boolean>;
    /**
     * WARNING! Ideally, this would be an abstract property, defined by each
     * concrete subclass (or other intermediate abstract classes, where
     * appropriate). Unfortunately it must be assigned here, so it will be present
     * for certain XPath DOM adapter functionality **during** each concrete node's
     * construction.
     *
     * Those subclasses nevertheless override this same property, assigning the
     * same value, for the purposes of narrowing the XPath node kind semantics
     * appropriate for each node type.
     */
    readonly [XPathNodeKindKey]: XFormsXPathPrimaryInstanceDescendantNodeKind;
    readonly root: Root;
    abstract readonly nodeType: InstanceNodeType;
    readonly isAttached: Accessor<boolean>;
    readonly evaluator: EngineXPathEvaluator;
    readonly contextNode: PrimaryInstanceXPathChildNode;
    readonly getActiveLanguage: Accessor<ActiveLanguage>;
    readonly valueChangedActions: ActionDefinition[];
    constructor(parent: Parent, instanceNode: StaticAttribute | StaticElement | null, definition: Definition, options?: DescendantNodeOptions);
    /**
     * @package
     *
     * Performs recursive removal, first of the node's descendants, then of the
     * node itself. For all {@link DescendantNode}s, removal involves **at least**
     * disposal of its {@link scope} ({@link ReactiveScope}).
     *
     * It is expected that the outermost node targeted for removal will always be
     * a {@link RepeatInstance}. @see {@link RepeatInstance.remove} for additional
     * details.
     *
     * It is also expected that upon that outermost node's removal, its parent
     * {@link RepeatRange} will perform a reactive update to its children state so
     * that:
     *
     * 1. Any downstream computations affected by the removal are updated.
     * 2. The client invoking removal is also reactively updated (where
     *    applicable).
     *
     * @see {@link RepeatInstance.remove} and {@link RepeatRange.removeInstances}
     * for additional details about their respective node-specific removal
     * behaviors and ordering.
     */
    remove(this: AnyChildNode): void;
}
export {};
