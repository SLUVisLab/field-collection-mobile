import { ParsedTokenList } from '../lib/TokenListParser.ts';
import { NodeDefinition } from '../parse/model/NodeDefinition.ts';
/**
 * - Provides a means to distinguish between internal and client-facing names
 *   for the same {@link ParsedTokenList} types.
 *
 * - Anticipates some iteration on both parsed ("definition") types and
 *   client-facing node types, which may not happen in tandem.
 */
export type NodeAppearances<Definition extends NodeDefinition<any>> = Definition extends {
    readonly bodyElement: {
        readonly appearances: infer Appearances extends ParsedTokenList<any>;
    };
} ? Appearances : null;
