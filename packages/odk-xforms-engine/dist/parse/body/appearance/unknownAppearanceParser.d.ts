import { TokenListParser, ParsedTokenList } from '../../../lib/TokenListParser.ts';
export declare const unknownAppearanceParser: TokenListParser<string, string>;
export type UnknownAppearanceDefinition = ParsedTokenList<typeof unknownAppearanceParser>;
