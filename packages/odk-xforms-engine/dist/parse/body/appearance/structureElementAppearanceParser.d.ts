import { TokenListParser, ParsedTokenList } from '../../../lib/TokenListParser.ts';
export declare const structureElementAppearanceParser: TokenListParser<"field-list" | "table-list", "field-list" | "table-list">;
export type StructureElementAppearanceDefinition = ParsedTokenList<typeof structureElementAppearanceParser>;
