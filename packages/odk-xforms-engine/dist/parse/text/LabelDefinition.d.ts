import { XFormDefinition } from '../../parse/XFormDefinition.ts';
import { AnyControlDefinition } from '../body/control/ControlDefinition.ts';
import { GroupElementDefinition } from '../body/GroupElementDefinition.ts';
import { RepeatElementDefinition } from '../body/RepeatElementDefinition.ts';
import { TextElementDefinition } from './abstract/TextElementDefinition.ts';
export type LabelOwner = AnyControlDefinition | GroupElementDefinition | RepeatElementDefinition;
export declare class LabelDefinition extends TextElementDefinition<'label'> {
    static forControl(form: XFormDefinition, control: AnyControlDefinition): LabelDefinition | null;
    static forRepeatGroup(form: XFormDefinition, repeat: RepeatElementDefinition): LabelDefinition | null;
    static forGroup(form: XFormDefinition, group: GroupElementDefinition): LabelDefinition | null;
    readonly role = "label";
    private constructor();
}
