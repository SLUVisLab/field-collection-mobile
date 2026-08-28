import { JRResourceURL } from '../../../../common/src/jr-resources/JRResourceURL.ts';
import { MarkdownNode } from '../../client/MarkdownNode.ts';
import { TextRange as ClientTextRange, TextChunk, TextRole } from '../../client/TextRange.ts';
export interface MediaSources {
    image?: JRResourceURL;
    video?: JRResourceURL;
    audio?: JRResourceURL;
}
export declare class TextRange<Role extends TextRole> implements ClientTextRange<Role> {
    readonly role: Role;
    protected readonly chunks: readonly TextChunk[];
    protected readonly mediaSources?: MediaSources | undefined;
    [Symbol.iterator](): Generator<TextChunk, void, unknown>;
    get formatted(): MarkdownNode[];
    get asString(): string;
    get imageSource(): JRResourceURL | undefined;
    get audioSource(): JRResourceURL | undefined;
    get videoSource(): JRResourceURL | undefined;
    constructor(role: Role, chunks: readonly TextChunk[], mediaSources?: MediaSources | undefined);
}
