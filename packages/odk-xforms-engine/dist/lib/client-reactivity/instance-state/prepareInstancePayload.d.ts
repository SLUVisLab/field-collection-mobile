import { InstanceFile as ClientInstanceFile } from '../../../client/serialization/InstanceFile.ts';
import { InstancePayload } from '../../../client/serialization/InstancePayload.ts';
import { InstancePayloadType } from '../../../client/serialization/InstancePayloadOptions.ts';
import { ClientReactiveSerializableInstance } from '../../../instance/internal-api/serialization/ClientReactiveSerializableInstance.ts';
export declare class InstanceFile extends File implements ClientInstanceFile {
    readonly name = "xml_submission_file";
    readonly type = "text/xml";
    constructor(instanceXML: string);
}
export interface Submission {
    readonly instanceFile: InstanceFile;
    readonly attachments: readonly File[];
}
export interface PrepareInstancePayloadOptions<PayloadType extends InstancePayloadType> {
    readonly payloadType: PayloadType;
    readonly maxSize: number;
}
export declare const prepareInstancePayload: <PayloadType extends InstancePayloadType>(instanceRoot: ClientReactiveSerializableInstance, options: PrepareInstancePayloadOptions<PayloadType>) => Promise<InstancePayload<PayloadType>>;
