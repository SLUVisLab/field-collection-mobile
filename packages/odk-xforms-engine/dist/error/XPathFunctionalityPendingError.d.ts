import { XPathFunctionalityErrorCategory, XPathFunctionalityError } from './XPathFunctionalityError.ts';
type XPathFunctionalityPendingStub = () => never;
export declare class XPathFunctionalityPendingError extends XPathFunctionalityError {
    static createStubImplementation(category: XPathFunctionalityErrorCategory): XPathFunctionalityPendingStub;
    private constructor();
}
export {};
