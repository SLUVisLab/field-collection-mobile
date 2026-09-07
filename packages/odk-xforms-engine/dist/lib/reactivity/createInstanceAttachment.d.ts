import { InstanceAttachmentFileName, InstanceAttachment } from '../../instance/attachments/InstanceAttachment.ts';
import { InstanceAttachmentContext } from '../../instance/internal-api/InstanceAttachmentContext.ts';
export type InstanceAttachmentRuntimeValue = File | null;
export type InstanceAttachmentFormDataEntry = readonly [
    key: InstanceAttachmentFileName,
    value: NonNullable<InstanceAttachmentRuntimeValue>
];
export type AttachmentLoadingError = 'network-error' | 'not-found';
export interface BaseInstanceAttachmentState {
    readonly computedName: string | null;
    readonly intrinsicName: string | null;
    readonly file: InstanceAttachmentRuntimeValue;
    readonly loading: boolean;
    readonly loadingError: AttachmentLoadingError | false;
    readonly dirty: boolean;
}
export declare const createInstanceAttachment: (context: InstanceAttachmentContext) => InstanceAttachment;
