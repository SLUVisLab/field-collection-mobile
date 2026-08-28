import { TokenListParser, ParsedTokenList } from '../../../lib/TokenListParser.ts';
export declare const selectAppearanceParser: TokenListParser<"map" | "label" | "compact" | "horizontal" | "horizontal-compact" | "list-nolabel" | "minimal" | "columns" | "columns-1" | "columns-2" | "columns-3" | "columns-4" | "columns-5" | "columns-pack" | "autocomplete" | "likert" | "quick" | "quickcompact", "autocomplete">;
export type SelectAppearanceDefinition = ParsedTokenList<typeof selectAppearanceParser>;
