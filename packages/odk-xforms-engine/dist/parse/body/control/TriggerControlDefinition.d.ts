import { XFormDefinition } from '../../XFormDefinition.ts';
import { UnknownAppearanceDefinition } from '../appearance/unknownAppearanceParser.ts';
import { BodyElementParentContext } from '../BodyDefinition.ts';
import { ControlDefinition } from './ControlDefinition.ts';
export declare class TriggerControlDefinition extends ControlDefinition<'trigger'> {
    static isCompatible(localName: string): boolean;
    readonly type = "trigger";
    readonly appearances: UnknownAppearanceDefinition;
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
    toJSON(): object;
}
