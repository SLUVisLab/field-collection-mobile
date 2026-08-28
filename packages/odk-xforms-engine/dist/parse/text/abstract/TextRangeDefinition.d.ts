import { LocalNamedElement } from '../../../../../common/types/dom.ts';
import { TextRole } from '../../../client/TextRange.ts';
import { XFormDefinition } from '../../../parse/XFormDefinition.ts';
import { DependencyContext } from '../../expression/abstract/DependencyContext.ts';
import { TextChunkExpression } from '../../expression/TextChunkExpression.ts';
import { AnyMessageDefinition } from '../MessageDefinition.ts';
import { AnyTextElementDefinition } from './TextElementDefinition.ts';
export type TextBindAttributeLocalName = 'constraintMsg' | 'requiredMsg';
export type TextBodyElementLocalName = 'hint' | 'label';
interface TextSourceNodes {
    readonly constraintMsg: null;
    readonly hint: LocalNamedElement<'hint'>;
    readonly label: LocalNamedElement<'label'>;
    readonly 'item-label': LocalNamedElement<'label'>;
    readonly requiredMsg: null;
}
export type TextSourceNode<Type extends TextRole> = TextSourceNodes[Type];
export declare abstract class TextRangeDefinition<Role extends TextRole> extends DependencyContext {
    readonly form: XFormDefinition;
    readonly ownerContext: DependencyContext;
    readonly sourceNode: TextSourceNode<Role>;
    abstract readonly role: Role;
    readonly parentReference: string | null;
    readonly reference: string | null;
    abstract readonly chunks: ReadonlyArray<TextChunkExpression<'nodes' | 'string'>>;
    get isTranslated(): boolean;
    set isTranslated(value: true);
    protected constructor(form: XFormDefinition, ownerContext: DependencyContext, sourceNode: TextSourceNode<Role>);
    toJSON(): object;
}
export type AnyTextRangeDefinition = AnyMessageDefinition | AnyTextElementDefinition;
export {};
