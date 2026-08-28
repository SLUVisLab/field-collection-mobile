import { XFormDefinition } from '../../parse/XFormDefinition.ts';
import { AnyControlDefinition } from '../body/control/ControlDefinition.ts';
import { TextElementDefinition } from './abstract/TextElementDefinition.ts';
export declare class HintDefinition extends TextElementDefinition<'hint'> {
    static forElement(form: XFormDefinition, owner: AnyControlDefinition): HintDefinition | null;
    readonly role = "hint";
    private constructor();
}
