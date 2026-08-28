import { AnyBodyElementDefinition } from '../body/BodyDefinition.ts';
import { BindDefinition } from './BindDefinition.ts';
import { NodeDefinitionType, ParentNodeDefinition, NodeDefinition } from './NodeDefinition.ts';
import { RootDefinition } from './RootDefinition.ts';
export type DescendentNodeType = Exclude<NodeDefinitionType, 'root'>;
type DescendentNodeBodyElement = AnyBodyElementDefinition;
export declare abstract class DescendentNodeDefinition<Type extends DescendentNodeType, BodyElement extends DescendentNodeBodyElement | null = DescendentNodeBodyElement | null> extends NodeDefinition<Type> {
    readonly parent: ParentNodeDefinition;
    readonly bodyElement: BodyElement;
    readonly root: RootDefinition;
    readonly isTranslated: boolean;
    constructor(parent: ParentNodeDefinition, bind: BindDefinition, bodyElement: BodyElement);
}
export {};
