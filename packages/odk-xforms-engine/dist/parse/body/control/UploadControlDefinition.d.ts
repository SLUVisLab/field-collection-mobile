import { UploadNodeOptions } from '../../../client/UploadNode.ts';
import { XFormDefinition } from '../../XFormDefinition.ts';
import { UploadAppearanceDefinition } from '../appearance/uploadAppearanceParser.ts';
import { BodyElementParentContext } from '../BodyDefinition.ts';
import { ControlDefinition } from './ControlDefinition.ts';
export declare class UploadControlDefinition extends ControlDefinition<'upload'> {
    static isCompatible(localName: string): boolean;
    readonly type = "upload";
    readonly appearances: UploadAppearanceDefinition;
    readonly options: UploadNodeOptions;
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
    toJSON(): object;
}
