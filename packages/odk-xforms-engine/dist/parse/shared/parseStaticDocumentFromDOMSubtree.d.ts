import { StaticDocument } from '../../integration/xpath/static-dom/StaticDocument.ts';
interface ParseStaticDocumentFromDOMSubtreeOptions {
    readonly nodesetPrefix?: string;
}
export declare const parseStaticDocumentFromDOMSubtree: (subtreeRootElement: Element, options?: ParseStaticDocumentFromDOMSubtreeOptions) => StaticDocument;
export {};
