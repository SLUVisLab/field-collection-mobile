import { ResolvableInstanceAttachmentsMap } from '../../client/form/EditFormInstance.ts';
import { InstanceData } from '../../client/index.ts';
export declare class InstanceAttachmentMap extends Map<string, Promise<File>> {
    private resolvable;
    static from(sources: readonly InstanceData[]): InstanceAttachmentMap;
    static resolve(input: ResolvableInstanceAttachmentsMap): InstanceAttachmentMap;
    retry(fileName: string): void;
    private setResolvable;
    private constructor();
}
