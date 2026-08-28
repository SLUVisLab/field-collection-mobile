import { InstanceState } from '../../../client/serialization/InstanceState.ts';
import { QualifiedName } from '../../../lib/names/QualifiedName.ts';
import { BindDefinition } from '../../../parse/model/BindDefinition.ts';
import { Attribute } from '../../Attribute.ts';
import { ClientReactiveSerializableChildNode, ClientReactiveSerializableParentNode } from './ClientReactiveSerializableParentNode.ts';
export type SerializedInstanceValue = string;
interface ClientReactiveSerializableValueNodeCurrentState {
    get relevant(): boolean;
    /**
     * @todo Consider moving into {@link InstanceState}
     */
    get instanceValue(): SerializedInstanceValue;
    get attributes(): readonly Attribute[];
}
interface ClientReactiveSerializableValueNodeDefinition {
    readonly qualifiedName: QualifiedName;
    readonly bind: BindDefinition;
}
export interface ClientReactiveSerializableValueNode {
    readonly definition: ClientReactiveSerializableValueNodeDefinition;
    readonly parent: ClientReactiveSerializableParentNode<ClientReactiveSerializableChildNode>;
    readonly currentState: ClientReactiveSerializableValueNodeCurrentState;
    readonly instanceState: InstanceState;
}
export {};
