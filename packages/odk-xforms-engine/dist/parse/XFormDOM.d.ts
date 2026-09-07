import { KnownAttributeLocalNamedElement } from '../../../common/types/dom.ts';
export declare const SET_VALUE_LOCAL_NAME = "setvalue";
export declare const SET_GEOPOINT_LOCAL_NAME = "odk:setgeopoint";
interface DOMBindElement extends KnownAttributeLocalNamedElement<'bind', 'nodeset'> {
}
export interface DOMSetValueElement extends KnownAttributeLocalNamedElement<'setvalue', 'event'> {
}
export interface DOMSetGeopointElement extends KnownAttributeLocalNamedElement<'odk:setgeopoint', 'event'> {
}
export interface DOMItextTranslationElement extends KnownAttributeLocalNamedElement<'translation', 'lang'> {
}
export interface DOMSecondaryInstanceElement extends KnownAttributeLocalNamedElement<'instance', 'id'> {
}
interface XFormDOMOptions {
    readonly isNormalized: boolean;
}
/**
 * @todo **Everything** in this class should be cacheable. Maybe not worth it
 * for small forms, but may make a pretty substantial difference for very large
 * forms (in bytes) in sessions creating multiple instances of the same form.
 */
export declare class XFormDOM {
    protected readonly sourceXML: string;
    static from(sourceXML: string): XFormDOM;
    isInstanceID: (nodeset: string) => boolean | null;
    protected readonly normalizedXML: string;
    readonly xformDocument: XMLDocument;
    readonly html: Element;
    readonly head: Element;
    readonly title: Element;
    readonly model: Element;
    readonly binds: readonly DOMBindElement[];
    readonly setValues: readonly DOMSetValueElement[];
    readonly setGeopoints: readonly DOMSetGeopointElement[];
    readonly primaryInstance: Element;
    readonly primaryInstanceRoot: Element;
    readonly itextTranslationElements: readonly DOMItextTranslationElement[];
    readonly secondaryInstanceElements: readonly DOMSecondaryInstanceElement[];
    readonly body: Element;
    protected constructor(sourceXML: string, options: XFormDOMOptions);
    toJSON(): Omit<this, "head" | "html" | "title" | "toJSON" | "primaryInstance" | "model" | "primaryInstanceRoot" | "xformDocument"> & {
        xformDocument: string;
        html: string;
        head: string;
        title: string;
        model: string;
        primaryInstance: string;
        primaryInstanceRoot: string;
    };
}
export {};
