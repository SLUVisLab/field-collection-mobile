import { Accessor } from 'solid-js';
import { FormNodeID } from '../../client/identity.ts';
import { StaticLeafElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { ReactiveScope } from '../../lib/reactivity/scope.ts';
import { InstanceAttachmentsState } from '../attachments/InstanceAttachmentsState.ts';
import { InstanceConfig } from './InstanceConfig.ts';
interface InstanceAttachmentRootDocument {
    readonly attachments: InstanceAttachmentsState;
}
export interface InstanceAttachmentContext {
    readonly instanceConfig: InstanceConfig;
    readonly scope: ReactiveScope;
    readonly rootDocument: InstanceAttachmentRootDocument;
    readonly nodeId: FormNodeID;
    readonly instanceNode: StaticLeafElement | null;
    readonly isRelevant: Accessor<boolean>;
    readonly isAttached: Accessor<boolean>;
}
export {};
