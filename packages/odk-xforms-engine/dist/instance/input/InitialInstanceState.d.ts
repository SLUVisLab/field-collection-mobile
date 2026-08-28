import { EditFormInstanceInput } from '../../client/form/EditFormInstance.ts';
import { InstanceData } from '../../client/serialization/InstanceData.ts';
import { StaticDocument } from '../../integration/xpath/static-dom/StaticDocument.ts';
import { ModelDefinition } from '../../parse/model/ModelDefinition.ts';
import { InstanceAttachmentMap } from './InstanceAttachmentMap.ts';
export type InitialInstanceStateSources = readonly [InstanceData, ...InstanceData[]];
export declare class InitialInstanceState {
    static from(model: ModelDefinition, data: InitialInstanceStateSources): Promise<InitialInstanceState>;
    static resolve(model: ModelDefinition, input: EditFormInstanceInput): Promise<InitialInstanceState>;
    readonly document: StaticDocument;
    readonly attachments: InstanceAttachmentMap;
    private constructor();
}
