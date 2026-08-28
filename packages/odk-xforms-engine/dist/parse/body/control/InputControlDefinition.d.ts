import { XFormDefinition } from '../../XFormDefinition.ts';
import { InputAppearanceDefinition } from '../appearance/inputAppearanceParser.ts';
import { BodyElementParentContext } from '../BodyDefinition.ts';
import { ControlDefinition } from './ControlDefinition.ts';
export declare class InputControlDefinition extends ControlDefinition<'input'> {
    static isCompatible(localName: string): boolean;
    readonly type = "input";
    readonly appearances: InputAppearanceDefinition;
    readonly rows: number | null;
    readonly accuracyThreshold: number | null;
    readonly unacceptableAccuracyThreshold: number | null;
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
}
