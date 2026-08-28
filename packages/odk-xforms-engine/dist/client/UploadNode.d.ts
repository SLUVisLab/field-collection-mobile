import { PartiallyKnownString } from '../../../common/types/string/PartiallyKnownString.ts';
import { BaseInstanceAttachmentState } from '../lib/reactivity/createInstanceAttachment.ts';
import { UploadAppearanceDefinition } from '../parse/body/appearance/uploadAppearanceParser.ts';
import { UploadControlDefinition } from '../parse/body/control/UploadControlDefinition.ts';
import { LeafNodeDefinition } from '../parse/model/LeafNodeDefinition.ts';
import { BaseValueNode, BaseValueNodeState } from './BaseValueNode.ts';
import { GeneralParentNode } from './hierarchy.ts';
import { RootNode } from './RootNode.ts';
import { InstanceAttachmentFileName } from './serialization/InstanceData.ts';
import { LeafNodeValidationState } from './validation.ts';
import { ValueType } from './ValueType.ts';
export type UploadValue = File | null;
export interface UploadNodeState extends BaseValueNodeState<UploadValue> {
    get valueOptions(): null;
    get value(): UploadValue;
    get instanceValue(): InstanceAttachmentFileName;
    get attachmentState(): BaseInstanceAttachmentState;
}
export interface UploadDefinition<V extends ValueType = ValueType> extends LeafNodeDefinition<V> {
    readonly bodyElement: UploadControlDefinition;
}
export type UploadMediaType = PartiallyKnownString<'*' | 'audio' | 'image' | 'video'>;
export type UploadMediaSubtype = PartiallyKnownString<'*'>;
export type UploadMediaAccept = PartiallyKnownString<'*' | `${UploadMediaType}/${UploadMediaSubtype}`>;
interface BaseUploadMediaOptions {
    readonly accept: UploadMediaAccept;
    readonly type: UploadMediaType | null;
    readonly subtype: UploadMediaSubtype | null;
}
export interface ExplicitUploadMediaOptions extends BaseUploadMediaOptions {
    readonly type: UploadMediaType;
    readonly subtype: UploadMediaSubtype;
}
export interface UnspecifiedUploadMediaOptions extends BaseUploadMediaOptions {
    readonly type: null;
    readonly subtype: null;
}
export type UploadMediaOptions = ExplicitUploadMediaOptions | UnspecifiedUploadMediaOptions;
export interface UploadNodeOptions {
    readonly media: UploadMediaOptions;
}
export interface UploadNode extends BaseValueNode<'binary', UploadValue> {
    readonly nodeType: 'upload';
    readonly appearances: UploadAppearanceDefinition;
    readonly nodeOptions: UploadNodeOptions;
    readonly valueType: 'binary';
    readonly definition: UploadDefinition<'binary'>;
    readonly root: RootNode;
    readonly parent: GeneralParentNode;
    readonly currentState: UploadNodeState;
    readonly validationState: LeafNodeValidationState;
    readonly maxPixels: number | null;
    setValue(value: UploadValue): RootNode;
    retryFetch(): void;
}
export {};
