import { NamespaceURI } from './QualifiedName.ts';
interface NamespaceDeclarationXMLSerializationOptions {
    readonly omitDefaultNamespace?: boolean;
}
export interface NamespaceDeclarationOptions {
    readonly declaredPrefix: string | null;
    readonly declaredURI: NamespaceURI;
}
/**
 * Provides a generalized representation of an XML namespace declaration, which
 * can be used for:
 *
 * - Resolution of a declared namespace URI, by its declared prefix
 * - Resolution of a declared namespace prefix associated with its namespace URI
 * - Scoped resolution of same in an arbitrary DOM-like tree of nodes (or
 *   representations thereof)
 * - Serialization of the namespace declaration as an XML representation, as
 *   part of broader XML serialization logic from an arbitrary DOM-like tree of
 *   nodes (or representations thereof)
 *
 * @see {@link NamespaceDeclarationMap} for details on scoped usage
 */
export declare class NamespaceDeclaration {
    private readonly serializedXML;
    /**
     * A namespace is declared as either:
     *
     * - a "default" namespace (for which no prefix is declared, in which case
     *   this value will be `null`)
     *
     * - a namespace prefix (for which the prefix can be used to reference the
     *   declared namespace, in which case this value will be a `string`)
     */
    readonly declaredPrefix: string | null;
    /**
     * A namespace is declared for a {@link NamespaceURI}, i.e. either a
     * {@link URL} or `null`, where `null` corresponds to the "null namespace"
     * (i.e. `xmlns=""` or `xmlns:prefix=""`, in serialized XML).
     */
    readonly declaredURI: NamespaceURI;
    constructor(options: NamespaceDeclarationOptions);
    declaresNamespaceURI(namespaceURI: NamespaceURI): boolean;
    serializeNamespaceDeclarationXML(options?: NamespaceDeclarationXMLSerializationOptions): string;
}
export {};
