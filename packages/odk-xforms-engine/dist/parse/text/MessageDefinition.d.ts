import { TextChunkExpression } from '../expression/TextChunkExpression.ts';
import { BindDefinition } from '../model/BindDefinition.ts';
import { TextBindAttributeLocalName, TextRangeDefinition } from './abstract/TextRangeDefinition.ts';
export declare class MessageDefinition<Type extends TextBindAttributeLocalName> extends TextRangeDefinition<Type> {
    readonly role: Type;
    static from<Type extends TextBindAttributeLocalName>(bind: BindDefinition, type: Type): MessageDefinition<Type> | null;
    readonly chunks: ReadonlyArray<TextChunkExpression<'nodes' | 'string'>>;
    private constructor();
}
export type AnyMessageDefinition = MessageDefinition<TextBindAttributeLocalName>;
