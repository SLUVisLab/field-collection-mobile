import { Accessor } from 'solid-js';
import { EvaluationContext } from '../../instance/internal-api/EvaluationContext.ts';
import { NoteNodeDefinition } from '../../parse/model/NoteNodeDefinition.ts';
export declare const createNoteReadonlyThunk: (context: EvaluationContext, definition: NoteNodeDefinition) => Accessor<true>;
