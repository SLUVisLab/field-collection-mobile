import { PartiallyKnownString } from '../../../../common/types/string/PartiallyKnownString.ts';
interface ReferenceParsingContext {
    readonly reference: string | null;
    readonly parent?: ReferenceParsingContext | null;
}
type ReferenceAttributeName = PartiallyKnownString<'nodeset' | 'ref'>;
interface KnownAttributeElement<AttributeName extends string> extends Element {
    getAttribute(name: AttributeName): string;
    getAttribute(name: string): string | null;
}
type ParsedReferenceAttribute<T extends Element, AttributeName extends string> = T extends KnownAttributeElement<AttributeName> ? string : string | null;
/**
 * Parses a `nodeset` reference from an arbitrary form definition element, and
 * resolves that (potentially relative) reference to the provided context.
 */
export declare const parseNodesetReference: <const AttributeName extends ReferenceAttributeName, T extends Element | KnownAttributeElement<AttributeName>>(parentContext: ReferenceParsingContext, element: T, attributeName: AttributeName) => ParsedReferenceAttribute<T, AttributeName>;
export {};
