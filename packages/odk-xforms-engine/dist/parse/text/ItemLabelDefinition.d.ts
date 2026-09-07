import { XFormDefinition } from '../../parse/XFormDefinition.ts';
import { ItemDefinition } from '../body/control/ItemDefinition.ts';
import { TextElementDefinition } from './abstract/TextElementDefinition.ts';
export declare class ItemLabelDefinition extends TextElementDefinition<'item-label'> {
    static from(form: XFormDefinition, owner: ItemDefinition): ItemLabelDefinition | null;
    readonly role = "item-label";
    private constructor();
}
