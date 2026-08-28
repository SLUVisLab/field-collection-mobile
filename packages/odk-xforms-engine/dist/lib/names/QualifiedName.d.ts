import { NamespaceURL } from './NamespaceURL.ts';
export type NamespaceURI = NamespaceURL | null;
export type QualifiedNamePrefix = string | null;
export interface NamespaceQualifiedNameSource {
    readonly namespaceURI: NamespaceURI | string;
    readonly localName: string;
    /**
     * Note that this property is intentionally optional as one of the
     * {@link QualifiedNameSource | QualifiedName source input}, and its absence
     * is treated differently from an explicitly assigned `null` value.
     *
     * @see {@link SourcePrefixUnspecified}, {@link DeferredPrefix}
     */
    readonly prefix?: QualifiedNamePrefix;
}
declare const SOURCE_PREFIX_UNSPECIFIED: unique symbol;
/**
 * May be used as a placeholder for a {@link QualifiedName.prefix}, where the
 * actual prefix may not be known at definition time.
 *
 * Example: parsing non-XML sources into an XML-like tree, e.g. for XPath
 * evaluation; in which case, we may not need to resolve a prefix for the name
 * until such a node is serialized as XML, if it ever is.
 */
type SourcePrefixUnspecified = typeof SOURCE_PREFIX_UNSPECIFIED;
/**
 * Represents a {@link QualifiedName.prefix} whose resolution may be deferred,
 * e.g. until all requisite parsing is complete and/or until XML serialization
 * requires use of a prefix to represent the corresponding
 * {@link QualifiedName.namespaceURI}.
 */
type DeferredPrefix = string | null | SourcePrefixUnspecified;
interface DeferredPrefixedQualifiedNameSource {
    readonly namespaceURI: NamespaceURI | string;
    readonly prefix: DeferredPrefix;
    readonly localName: string;
}
export type QualifiedNameSource = NamespaceQualifiedNameSource | DeferredPrefixedQualifiedNameSource;
interface PrefixResolutionOptions {
    lookupPrefix(namespaceURI: NamespaceURI | string): string | null;
}
/**
 * @todo This is in the `lib` directory because it's a cross-cutting concern,
 * applicable to:
 *
 * - Parsing XML into a useful runtime data model (usage which motivated initial
 *   development of this class)
 * - Serializing XML from a runtime data model (also motivated initial dev)
 * - `@getodk/xpath` (internal) e.g. references to
 *   {@link https://www.w3.org/TR/REC-xml-names/#NT-QName | QName} in various
 *   parts of XPath expression _syntax_, as well as various parts of the package
 *   interpreting those parts of syntax
 * - `@getodk/xpath` (cross-package), e.g. in aspects of the
 *   {@link XPathDOMAdapter} APIs, and implementations thereof
 * - A zillion potential optimizations, e.g. where names are useful in a lookup
 *   table (or used in conjunction with other information to construct keys for
 *   same)
 *
 * @todo As a cross-cutting concern, there are subtle but important differences
 * between certain XPath and XML semantics around expressions of a "null"
 * {@link prefix}. E.g. in the expression `/foo`, **technically** the `foo` Step
 * should select child elements _in the null namespace_, whereas in most other
 * cases a null prefix (when explicitly assigned `null`, rather than
 * {@link DeferredPrefix | deferred for later resolution}) is expected to
 * correspond _to the default namespace_ (whatever that is in the context of the
 * {@link QualifiedName | qualified-named thing}).
 *
 * @todo As a mechanism for many optimizations, an evolution of this class would
 * be **BY FAR** most useful if it can be treated as a _value type_, despite
 * challenges using non-primitives as such in a JS runtime. To be clear: it
 * would be most useful if every instance of {@link QualifiedName} having the
 * same property values (or in some cases, the same combined
 * {@link namespaceURI}/{@link localName} or combined
 * {@link prefix}/{@link localName}) would also have _reference equality_ with
 * other instances having the same property values (or pertinent subset
 * thereof). Making a somewhat obvious point explicit: this would be
 * particularly useful in cases where a lookup table is implemented as a native
 * {@link Map}, where using {@link QualifiedName} as a key would break
 * expectations (and probably quite a lot of functionality!) if 2+ equivalent
 * keys mapped to different values.
 *
 * @todo Where we would want to treat instances as a value type, it would be
 * useful to look at prior art for representation of the same data as a string.
 * One frame of reference worth looking at is
 * {@link https://www.w3.org/TR/xpath-30/#prod-xpath30-URIQualifiedName | XPath 3.0's URIQualifiedName}
 * (but note that this syntax is mutually exclusive with the prefixed `QName`).
 */
export declare class QualifiedName implements DeferredPrefixedQualifiedNameSource {
    private readonly defaultPrefixResolutionOptions;
    readonly namespaceURI: NamespaceURI;
    /**
     * @see {@link SourcePrefixUnspecified}, {@link DeferredPrefix}
     */
    readonly prefix: DeferredPrefix;
    readonly localName: string;
    constructor(source: QualifiedNameSource);
    /**
     * @todo at time of writing, it's not expected we will actually supply
     * {@link options} in calls to this method! Current calls are from definitions
     * whose prefixes are known at parse time (i.e. they are prefixed in the
     * source XML from which they're parsed).
     *
     * The intent of accepting the options here now is to leave a fairly large
     * breadcrumb, for any use case where we might want to serialize XML from
     * artificially constructed DOM-like trees (e.g. `StaticNode` implementations
     * defined by parsing non-XML external secondary instances such as CSV and
     * GeoJSON). AFAIK this doesn't correspond to any known feature in the "like
     * Collect" scope, but it could have implications for inspecting form details
     * in e.g. "debug/form design/dev mode" scenarios.
     */
    getPrefixedName(options?: PrefixResolutionOptions): string;
}
export {};
