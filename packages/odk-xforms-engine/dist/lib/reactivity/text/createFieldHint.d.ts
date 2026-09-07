import { Accessor } from 'solid-js';
import { TextRange } from '../../../client/TextRange.ts';
import { EvaluationContext } from '../../../instance/internal-api/EvaluationContext.ts';
import { LeafNodeDefinition } from '../../../parse/model/LeafNodeDefinition.ts';
export declare const createFieldHint: (context: EvaluationContext, definition: LeafNodeDefinition) => Accessor<TextRange<"hint"> | null>;
