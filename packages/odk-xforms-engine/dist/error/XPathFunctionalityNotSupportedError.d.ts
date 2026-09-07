import { XPathFunctionalityErrorCategory, XPathFunctionalityError } from './XPathFunctionalityError.ts';
type XPathFunctionalityNotSupportedStub = () => never;
export declare class XPathFunctionalityNotSupportedError extends XPathFunctionalityError {
    static createStubImplementation(category: XPathFunctionalityErrorCategory): XPathFunctionalityNotSupportedStub;
    private constructor();
}
export {};
