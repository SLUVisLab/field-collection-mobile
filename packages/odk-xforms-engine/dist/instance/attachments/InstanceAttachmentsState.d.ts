import { FetchFormAttachment } from '../../client/resources.ts';
import { StaticLeafElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { InstanceAttachmentMap } from '../input/InstanceAttachmentMap.ts';
import { InstanceAttachmentContext } from '../internal-api/InstanceAttachmentContext.ts';
import { InstanceAttachment } from './InstanceAttachment.ts';
export declare class InstanceAttachmentsState extends Map<InstanceAttachmentContext, InstanceAttachment> {
    private readonly sourceAttachments;
    private readonly fetchFormAttachment;
    constructor(sourceAttachments?: InstanceAttachmentMap | null, fetchFormAttachment?: FetchFormAttachment | null);
    private resolveFormAttachmentFile;
    getInitialFileValue(instanceNode: StaticLeafElement | null): Promise<File> | null;
    retryFileValue(instanceNode: StaticLeafElement | null): void;
}
