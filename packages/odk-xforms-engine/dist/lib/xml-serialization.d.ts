import { GeneralChildNode } from '../client/hierarchy.ts';
import { Attribute } from '../instance/Attribute.ts';
import { NamespaceDeclarationMap } from './names/NamespaceDeclarationMap.ts';
import { QualifiedName } from './names/QualifiedName.ts';
declare const ESCAPED_XML_TEXT_BRAND: unique symbol;
export type EscapedXMLText = string & {
    readonly [ESCAPED_XML_TEXT_BRAND]: true;
};
/**
 * This is based on the `escapeHTML` implementation in
 * {@link https://github.com/ryansolid/dom-expressions} (Solid's JSX transform).
 *
 * @see {@link https://github.com/ryansolid/dom-expressions/pull/27} for
 * motivation to derive this implementation approach.
 *
 * The intent is that this can be updated easily if the base implementation
 * changes. As such, some aspects of this implementation differ from some of our
 * typical code style preferences.
 *
 * Notable changes from the base implementation:
 *
 * - Formatting: automated only.
 * - Naming: the {@link text} parameter is named `html` in the base
 *   implementation. That would be confusing if preserved.
 * - Types:
 *     - Parameter types are added (of course)
 *     - Return type is branded as {@link EscapedXMLText}, to allow downstream
 *       checks that escaping has been performed. Return statements are cast
 *       accordingly.
 *     - {@link text} attempts to minimize risk of double-escaping by excluding
 *       that same branded type.
 * - The '>' character is also escaped, necessary for producing valid XML.
 *
 * As with the base implementation, we leave some characters unescaped:
 *
 * - " (double quote): except when {@link attr} is `true`.
 *
 * - ' (single quote): on the assumption that attributes are always serialized
 *   in double quotes. If we ever move this to `@getodk/common`, we'd want to
 *   reconsider this assumption.
 */
export declare const escapeXMLText: <Text extends string>(text: Exclude<Text, EscapedXMLText>, attr?: boolean) => EscapedXMLText;
export declare const serializeAttributeXML: (qualifiedName: QualifiedName, xmlValue: EscapedXMLText) => string;
export declare const serializeParentElementXML: (qualifiedName: QualifiedName, children: readonly GeneralChildNode[], attributes: readonly Attribute[], namespaceDeclarations?: NamespaceDeclarationMap) => string;
export declare const serializeLeafElementXML: (qualifiedName: QualifiedName, xmlValue: EscapedXMLText, attributes: readonly Attribute[], namespaceDeclarations?: NamespaceDeclarationMap) => string;
export {};
