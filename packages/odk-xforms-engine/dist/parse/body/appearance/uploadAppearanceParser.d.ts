import { TokenListParser, ParsedTokenList } from '../../../lib/TokenListParser.ts';
export declare const uploadAppearanceParser: TokenListParser<"annotate" | "draw" | "signature", "annotate" | "draw" | "signature">;
export type UploadAppearanceDefinition = ParsedTokenList<typeof uploadAppearanceParser>;
