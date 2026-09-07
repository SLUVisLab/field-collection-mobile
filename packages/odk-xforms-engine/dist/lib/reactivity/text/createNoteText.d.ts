import { Accessor } from 'solid-js';
import { TextRange } from '../../../client/TextRange.ts';
import { EvaluationContext } from '../../../instance/internal-api/EvaluationContext.ts';
import { NoteTextDefinition } from '../../../parse/model/NoteNodeDefinition.ts';
export type NoteTextRole = 'label' | 'hint';
export type ComputedNoteText<Role extends NoteTextRole = NoteTextRole> = Accessor<TextRange<Role>>;
interface BaseNoteText {
    readonly role: NoteTextRole;
    readonly label: ComputedNoteText<'label'> | null;
    readonly hint: ComputedNoteText<'hint'> | null;
}
interface LabelNoteText extends BaseNoteText {
    readonly role: 'label';
    readonly label: ComputedNoteText<'label'>;
    readonly hint: null;
}
interface HintNoteText extends BaseNoteText {
    readonly role: 'hint';
    readonly label: null;
    readonly hint: ComputedNoteText<'hint'>;
}
export type NoteTextComputation = LabelNoteText | HintNoteText;
export declare const createNoteText: (context: EvaluationContext, noteTextDefinition: NoteTextDefinition) => NoteTextComputation;
export {};
