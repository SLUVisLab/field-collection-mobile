import { ValueType } from '../../client/ValueType.ts';
import { StaticLeafElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { NamespaceDeclarationMap, NamedSubtreeDefinition } from '../../lib/names/NamespaceDeclarationMap.ts';
import { QualifiedName } from '../../lib/names/QualifiedName.ts';
import { AnyBodyElementDefinition, ControlElementDefinition } from '../body/BodyDefinition.ts';
import { AttributeDefinitionMap } from './AttributeDefinitionMap.ts';
import { BindDefinition } from './BindDefinition.ts';
import { DescendentNodeDefinition } from './DescendentNodeDefinition.ts';
import { ModelDefinition } from './ModelDefinition.ts';
import { ParentNodeDefinition } from './NodeDefinition.ts';
export declare class LeafNodeDefinition<V extends ValueType = ValueType> extends DescendentNodeDefinition<'leaf-node', ControlElementDefinition | null> implements NamedSubtreeDefinition {
    readonly model: ModelDefinition;
    readonly template: StaticLeafElement;
    readonly type = "leaf-node";
    readonly valueType: V;
    readonly namespaceDeclarations: NamespaceDeclarationMap;
    readonly qualifiedName: QualifiedName;
    readonly children: null;
    readonly attributes: AttributeDefinitionMap;
    constructor(model: ModelDefinition, parent: ParentNodeDefinition, bind: BindDefinition, bodyElement: AnyBodyElementDefinition | null, template: StaticLeafElement);
    toJSON(): Omit<this, "parent" | "toJSON" | "bind" | "root" | "bodyElement">;
}
