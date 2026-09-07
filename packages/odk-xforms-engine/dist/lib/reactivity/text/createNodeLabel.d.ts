import { Accessor } from 'solid-js';
import { TextRange } from '../../../client/TextRange.ts';
import { EvaluationContext } from '../../../instance/internal-api/EvaluationContext.ts';
import { AnyNodeDefinition } from '../../../parse/model/NodeDefinition.ts';
export declare const createNodeLabel: (context: EvaluationContext, definition: AnyNodeDefinition) => Accessor<TextRange<"label"> | null>;
