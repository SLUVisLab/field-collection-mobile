import { SubmissionMeta } from '../../../client/submission/SubmissionMeta.ts';
import { AncestorNodeValidationState } from '../../../client/validation.ts';
import { InstanceAttachmentsState } from '../../attachments/InstanceAttachmentsState.ts';
import { Root } from '../../Root.ts';
import { ClientReactiveSerializableParentNode, ClientReactiveSerializableParentNodeDefinition } from './ClientReactiveSerializableParentNode.ts';
interface ClientReactiveSerializableInstanceDefinition extends ClientReactiveSerializableParentNodeDefinition {
    readonly submission: SubmissionMeta;
}
export interface ClientReactiveSerializableInstance extends ClientReactiveSerializableParentNode<Root> {
    readonly definition: ClientReactiveSerializableInstanceDefinition;
    readonly root: Root;
    readonly parent: null;
    readonly attachments: InstanceAttachmentsState;
    readonly validationState: AncestorNodeValidationState;
}
export {};
