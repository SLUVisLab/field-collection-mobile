import { ActiveLanguage } from '../../client/FormLanguage.ts';
import { TextChunk as ClientTextChunk, TextChunkSource } from '../../client/TextRange.ts';
import { TranslationContext } from '../internal-api/TranslationContext.ts';
export declare class TextChunk implements ClientTextChunk {
    readonly context: TranslationContext;
    readonly source: TextChunkSource;
    readonly asString: string;
    get language(): ActiveLanguage;
    constructor(context: TranslationContext, source: TextChunkSource, asString: string);
}
