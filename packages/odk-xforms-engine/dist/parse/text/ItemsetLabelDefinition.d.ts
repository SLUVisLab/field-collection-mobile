import { XFormDefinition } from '../../parse/XFormDefinition.ts';
import { ItemsetDefinition } from '../body/control/ItemsetDefinition.ts';
import { TextChunkExpression } from '../expression/TextChunkExpression.ts';
import { TextRangeDefinition } from './abstract/TextRangeDefinition.ts';
export declare class ItemsetLabelDefinition extends TextRangeDefinition<'item-label'> {
    static from(form: XFormDefinition, owner: ItemsetDefinition): ItemsetLabelDefinition | null;
    readonly role = "item-label";
    readonly chunks: ReadonlyArray<TextChunkExpression<'nodes' | 'string'>>;
    private constructor();
}
