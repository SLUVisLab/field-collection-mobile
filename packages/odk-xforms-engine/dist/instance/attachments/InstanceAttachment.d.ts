import { Accessor } from 'solid-js';
import { BaseInstanceAttachmentState } from '../../lib/reactivity/createInstanceAttachment.ts';
import { SimpleAtomicState, SimpleAtomicStateSetter } from '../../lib/reactivity/types.ts';
import { InstanceAttachmentContext } from '../internal-api/InstanceAttachmentContext.ts';
import { DecodeInstanceValue } from '../internal-api/InstanceValueContext.ts';
export type InstanceAttachmentFileName = string;
export type InstanceAttachmentRuntimeValue = File | null;
export interface InstanceAttachmentOptions {
    readonly getFileName: Accessor<InstanceAttachmentFileName | null>;
    readonly getInstanceValue: Accessor<InstanceAttachmentFileName>;
    readonly decodeInstanceValue: DecodeInstanceValue;
    readonly getValue: Accessor<InstanceAttachmentRuntimeValue>;
    readonly setValue: SimpleAtomicStateSetter<InstanceAttachmentRuntimeValue>;
    readonly valueState: SimpleAtomicState<InstanceAttachmentRuntimeValue>;
    readonly getState: Accessor<BaseInstanceAttachmentState>;
    readonly retry: () => void;
}
export declare class InstanceAttachment {
    /**
     * 1. Creates {@link InstanceAttachment | attachment state} from
     *    {@link InstanceAttachmentOptions}
     * 2. Registers that attachment state in an instance-global
     *    {@link InstanceAttachmentsState} entry
     *
     * This allows an instance to:
     *
     * - Produce distinct file names for each attachment
     * - Track all attachments so they can be serialized in an
     *   {@link InstancePayload}
     */
    static init(context: InstanceAttachmentContext, options: InstanceAttachmentOptions): InstanceAttachment;
    /**
     * This property isn't used at runtime. It causes TypeScript to treat
     * {@link InstanceAttachment} as a nominal type, ensuring
     * {@link InstanceAttachment.init} is called to instantiate it.
     */
    protected readonly _: null;
    readonly getFileName: Accessor<InstanceAttachmentFileName | null>;
    readonly getInstanceValue: Accessor<InstanceAttachmentFileName>;
    readonly decodeInstanceValue: DecodeInstanceValue;
    readonly getValue: Accessor<InstanceAttachmentRuntimeValue>;
    readonly setValue: SimpleAtomicStateSetter<InstanceAttachmentRuntimeValue>;
    readonly valueState: SimpleAtomicState<InstanceAttachmentRuntimeValue>;
    readonly getState: Accessor<BaseInstanceAttachmentState>;
    readonly retry: () => void;
    private constructor();
}
