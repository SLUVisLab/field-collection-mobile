import { StaticElement } from '../../../integration/xpath/static-dom/StaticElement.ts';
import { Attribute } from '../../Attribute.ts';
import { GeneralChildNode } from '../../hierarchy.ts';
import { ClientReactiveSerializableParentNode, ClientReactiveSerializableParentNodeCurrentState, ClientReactiveSerializableParentNodeDefinition } from './ClientReactiveSerializableParentNode.ts';
export interface ClientReactiveSerializableTemplatedNodeCurrentState extends ClientReactiveSerializableParentNodeCurrentState<GeneralChildNode> {
    get attributes(): readonly Attribute[];
}
export interface ClientReactiveSerializableTemplatedNodeDefinition extends ClientReactiveSerializableParentNodeDefinition {
    readonly template: StaticElement;
}
export interface ClientReactiveSerializableTemplatedNode extends ClientReactiveSerializableParentNode<GeneralChildNode> {
    readonly currentState: ClientReactiveSerializableTemplatedNodeCurrentState;
}
