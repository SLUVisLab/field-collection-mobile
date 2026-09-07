import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { NamespaceDeclarationMap } from '../../lib/names/NamespaceDeclarationMap.ts';
import { QualifiedName } from '../../lib/names/QualifiedName.ts';
import { BodyClassList } from '../body/BodyDefinition.ts';
import { XFormDefinition } from '../XFormDefinition.ts';
import { AttributeDefinitionMap } from './AttributeDefinitionMap.ts';
import { ModelDefinition } from './ModelDefinition.ts';
import { ChildNodeDefinition, ParentNodeDefinition, NodeDefinition } from './NodeDefinition.ts';
import { SubmissionDefinition } from './SubmissionDefinition.ts';
export declare class RootDefinition extends NodeDefinition<'root'> {
    protected readonly form: XFormDefinition;
    readonly model: ModelDefinition;
    readonly submission: SubmissionDefinition;
    readonly classes: BodyClassList;
    readonly type = "root";
    readonly qualifiedName: QualifiedName;
    readonly bodyElement: null;
    readonly root: this;
    readonly parent: null;
    readonly template: StaticElement;
    readonly namespaceDeclarations: NamespaceDeclarationMap;
    readonly attributes: AttributeDefinitionMap;
    readonly children: readonly ChildNodeDefinition[];
    readonly isTranslated = false;
    constructor(form: XFormDefinition, model: ModelDefinition, submission: SubmissionDefinition, classes: BodyClassList);
    private mapActions;
    buildSubtree(parent: ParentNodeDefinition, node: StaticElement): readonly ChildNodeDefinition[];
    toJSON(): Omit<this, "form" | "toJSON" | "bind" | "model" | "root" | "bodyElement" | "buildSubtree">;
}
