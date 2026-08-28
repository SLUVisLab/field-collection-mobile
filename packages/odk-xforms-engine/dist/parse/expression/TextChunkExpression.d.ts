import { JRResourceURLString, ResourceType } from '../../../../common/src/jr-resources/JRResourceURL.ts';
import { TextChunkSource } from '../../client/TextRange.ts';
import { DependentExpression } from './abstract/DependentExpression.ts';
interface TextChunkExpressionOptions {
    readonly type?: ResourceType;
}
export declare class TextChunkExpression<T extends 'nodes' | 'string'> extends DependentExpression<T> {
    readonly source: TextChunkSource;
    readonly stringValue: string;
    readonly resourceType: ResourceType | null;
    constructor(resultType: T, expression: string, source: TextChunkSource, literalValue?: string, options?: TextChunkExpressionOptions);
    static fromLiteral(stringValue: string): TextChunkExpression<'string'>;
    static fromReference(ref: string): TextChunkExpression<'string'>;
    static fromOutput(element: Element): TextChunkExpression<'string'> | null;
    static fromResource(url: JRResourceURLString, type: ResourceType): TextChunkExpression<'string'>;
    static fromTranslation(maybeExpression: string): TextChunkExpression<'nodes'> | null;
}
export {};
