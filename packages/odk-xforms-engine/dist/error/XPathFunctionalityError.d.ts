import { AnyFunction, ExpandUnion } from '../../../common/types/helpers.js';
import { XPathDOMAdapter, XPathNode } from '@getodk/xpath';
/**
 * @todo this is general enough to go in `@getodk/common`. Holding off until
 * it's clear we actually benefit from this particular type gymnastic.
 */
type MethodNameOf<T> = {
    [K in keyof T]: T[K] extends AnyFunction ? K : never;
}[keyof T];
export type XPathFunctionalityErrorCategory = ExpandUnion<MethodNameOf<XPathDOMAdapter<XPathNode>> | 'processing-instruction'>;
export declare abstract class XPathFunctionalityError extends Error {
    constructor(functionalityMessagePrefix: string, category: XPathFunctionalityErrorCategory);
}
export {};
