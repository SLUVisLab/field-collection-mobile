import { XFormDefinition } from '../XFormDefinition.ts';
import { BodyElementParentContext } from './BodyDefinition.ts';
import { BodyElementDefinition } from './BodyElementDefinition.ts';
export declare class UnsupportedBodyElementDefinition extends BodyElementDefinition<'UNSUPPORTED'> {
    static isCompatible(): boolean;
    readonly category = "UNSUPPORTED";
    readonly type = "UNSUPPORTED";
    readonly reference: null;
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
}
