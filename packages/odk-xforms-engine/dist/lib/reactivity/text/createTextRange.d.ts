import { Accessor } from 'solid-js';
import { TextRole } from '../../../client/TextRange.ts';
import { EvaluationContext } from '../../../instance/internal-api/EvaluationContext.ts';
import { TextRange } from '../../../instance/text/TextRange.ts';
import { TextRangeDefinition } from '../../../parse/text/abstract/TextRangeDefinition.ts';
type ComputedFormTextRange<Role extends TextRole> = Accessor<TextRange<Role>>;
/**
 * Creates a text range (e.g. label or hint) from the provided definition, reactive to:
 *
 * - The form's current language (e.g. `<label ref="jr:itext('text-id')" />`)
 * - Direct `<output>` references within the label's children
 */
export declare const createTextRange: <Role extends TextRole>(context: EvaluationContext, role: Role, definition: TextRangeDefinition<Role>) => ComputedFormTextRange<Role>;
export {};
