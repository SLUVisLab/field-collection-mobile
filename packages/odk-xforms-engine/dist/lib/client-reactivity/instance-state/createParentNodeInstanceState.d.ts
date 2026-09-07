import { InstanceState } from '../../../client/serialization/InstanceState.ts';
import { GeneralChildNode } from '../../../instance/hierarchy.ts';
import { ClientReactiveSerializableParentNode } from '../../../instance/internal-api/serialization/ClientReactiveSerializableParentNode.ts';
export declare const createParentNodeInstanceState: (node: ClientReactiveSerializableParentNode<GeneralChildNode>) => InstanceState;
