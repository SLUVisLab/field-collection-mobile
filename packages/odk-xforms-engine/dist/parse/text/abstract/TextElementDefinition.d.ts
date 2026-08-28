import { ElementTextRole } from '../../../client/TextRange.ts';
import { XFormDefinition } from '../../../parse/XFormDefinition.ts';
import { ItemDefinition } from '../../body/control/ItemDefinition.ts';
import { TextChunkExpression } from '../../expression/TextChunkExpression.ts';
import { HintDefinition } from '../HintDefinition.ts';
import { ItemLabelDefinition } from '../ItemLabelDefinition.ts';
import { ItemsetLabelDefinition } from '../ItemsetLabelDefinition.ts';
import { LabelDefinition, LabelOwner } from '../LabelDefinition.ts';
import { TextSourceNode, TextRangeDefinition } from './TextRangeDefinition.ts';
type TextElementOwner = ItemDefinition | LabelOwner;
export declare abstract class TextElementDefinition<Role extends ElementTextRole> extends TextRangeDefinition<Role> {
    readonly chunks: ReadonlyArray<TextChunkExpression<'nodes' | 'string'>>;
    constructor(form: XFormDefinition, owner: TextElementOwner, sourceNode: TextSourceNode<Role>);
}
export type AnyTextElementDefinition = HintDefinition | ItemLabelDefinition | ItemsetLabelDefinition | LabelDefinition;
export {};
