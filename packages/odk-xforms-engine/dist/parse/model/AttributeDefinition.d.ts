import { StaticAttribute } from '../../integration/xpath/static-dom/StaticAttribute.ts';
import { NamespaceDeclarationMap, NamedNodeDefinition } from '../../lib/names/NamespaceDeclarationMap.ts';
import { QualifiedName } from '../../lib/names/QualifiedName.ts';
import { BindDefinition } from './BindDefinition.ts';
import { ModelDefinition } from './ModelDefinition.ts';
import { NodeDefinition } from './NodeDefinition.ts';
import { RootDefinition } from './RootDefinition.ts';
export declare class AttributeDefinition extends NodeDefinition<'attribute'> implements NamedNodeDefinition {
    readonly model: ModelDefinition;
    readonly template: StaticAttribute;
    private readonly serializedXML;
    readonly value: string;
    readonly type = "attribute";
    readonly valueType = "string";
    readonly namespaceDeclarations: NamespaceDeclarationMap;
    readonly bodyElement: null;
    readonly root: RootDefinition;
    readonly isTranslated: boolean;
    readonly parent: null;
    readonly children: null;
    readonly attributes: null;
    readonly qualifiedName: QualifiedName;
    constructor(model: ModelDefinition, bind: BindDefinition, template: StaticAttribute);
    serializeAttributeXML(): string;
    toJSON(): Omit<this, "parent" | "toJSON" | "bind" | "root" | "bodyElement" | "serializeAttributeXML">;
}
