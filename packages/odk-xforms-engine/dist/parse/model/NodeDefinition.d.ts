import { StaticAttribute } from '../../integration/xpath/static-dom/StaticAttribute.ts';
import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { NamedSubtreeDefinition, NamespaceDeclarationMap } from '../../lib/names/NamespaceDeclarationMap.ts';
import { QualifiedName } from '../../lib/names/QualifiedName.ts';
import { AnyBodyElementDefinition } from '../body/BodyDefinition.ts';
import { RepeatElementDefinition } from '../body/RepeatElementDefinition.ts';
import { AttributeDefinition } from './AttributeDefinition.ts';
import { AttributeDefinitionMap } from './AttributeDefinitionMap.ts';
import { BindDefinition } from './BindDefinition.ts';
import { GroupDefinition } from './GroupDefinition.ts';
import { LeafNodeDefinition } from './LeafNodeDefinition.ts';
import { AnyRepeatDefinition } from './RepeatDefinition.ts';
import { RootDefinition } from './RootDefinition.ts';
/**
 * Corresponds to a model instance root node, i.e.:
 *
 * - the element matching `/*` in primary instance expressions, a.k.a.
 * - `/h:html/h:head/xf:model/xf:instance[1]/*`
 */
export type RootNodeType = 'root';
/**
 * Corresponds to the combined concepts defining a "repeat".
 *
 * @see {@link RepeatDefinition} for details on these concepts and how they are used to produce a "repeat definition", as such.
 *
 * , including or
 * referencing all of the following:
 *
 */
export type RepeatType = 'repeat';
/**
 * Corresponds to a model instance subtree which **does not** correspond to a
 * <repeat> in the form definition.
 */
export type GroupNodeType = 'group';
/**
 * Corresponds to a model instance leaf node, i.e. one of:
 *
 * - An element with no child elements
 * - Any attribute corresponding to a bind's `nodeset` expression
 */
export type LeafNodeType = 'leaf-node';
export type AttributeNodeType = 'attribute';
export type NodeDefinitionType = RootNodeType | RepeatType | GroupNodeType | LeafNodeType | AttributeNodeType;
export type ParentNodeDefinition = RootDefinition | AnyRepeatDefinition | GroupDefinition;
export type ChildNodeDefinition = AnyRepeatDefinition | GroupDefinition | LeafNodeDefinition;
export declare abstract class NodeDefinition<Type extends NodeDefinitionType> implements NamedSubtreeDefinition {
    readonly bind: BindDefinition;
    abstract readonly type: Type;
    abstract readonly namespaceDeclarations: NamespaceDeclarationMap;
    abstract readonly qualifiedName: QualifiedName;
    abstract readonly bodyElement: AnyBodyElementDefinition | RepeatElementDefinition | null;
    abstract readonly isTranslated: boolean;
    abstract readonly root: RootDefinition;
    abstract readonly parent: ParentNodeDefinition | null;
    abstract readonly template: StaticAttribute | StaticElement;
    abstract readonly children: readonly ChildNodeDefinition[] | null;
    abstract readonly attributes: AttributeDefinitionMap | null;
    readonly nodeset: string;
    constructor(bind: BindDefinition);
}
export type AnyNodeDefinition = RootDefinition | AnyRepeatDefinition | GroupDefinition | LeafNodeDefinition | AttributeDefinition;
