import { ParsedTokenList, TokenListParser } from '../../../lib/TokenListParser.ts';
export declare const rangeAppearanceParser: TokenListParser<"no-ticks" | "picker" | "rating" | "vertical", "no-ticks" | "picker" | "rating" | "vertical">;
export type RangeAppearanceDefinition = ParsedTokenList<typeof rangeAppearanceParser>;
