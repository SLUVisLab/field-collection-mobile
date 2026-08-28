import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { NamespaceDeclarationMap } from '../../lib/names/NamespaceDeclarationMap.ts';
import { QualifiedName } from '../../lib/names/QualifiedName.ts';
import { AnyBodyElementDefinition } from '../body/BodyDefinition.ts';
import { GroupElementDefinition } from '../body/GroupElementDefinition.ts';
import { AttributeDefinitionMap } from './AttributeDefinitionMap.ts';
import { BindDefinition } from './BindDefinition.ts';
import { DescendentNodeDefinition } from './DescendentNodeDefinition.ts';
import { ModelDefinition } from './ModelDefinition.ts';
import { ChildNodeDefinition, ParentNodeDefinition } from './NodeDefinition.ts';
export declare class GroupDefinition extends DescendentNodeDefinition<'group', GroupElementDefinition | null> {
    readonly model: ModelDefinition;
    readonly template: StaticElement;
    readonly type = "group";
    readonly namespaceDeclarations: NamespaceDeclarationMap;
    readonly qualifiedName: QualifiedName;
    readonly children: readonly ChildNodeDefinition[];
    readonly attributes: AttributeDefinitionMap;
    constructor(model: ModelDefinition, parent: ParentNodeDefinition, bind: BindDefinition, bodyElement: AnyBodyElementDefinition | null, template: StaticElement);
    toJSON(): Omit<this, "parent" | "toJSON" | "bind" | "root" | "bodyElement">;
}
