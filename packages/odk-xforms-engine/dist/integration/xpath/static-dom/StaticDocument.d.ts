import { XFormsXPathDocument } from '../adapter/XFormsXPathNode.ts';
import { StaticAttribute } from './StaticAttribute.ts';
import { StaticElementOptions, StaticElement } from './StaticElement.ts';
import { StaticParentNode } from './StaticParentNode.ts';
interface StaticDocumentOptions {
    readonly documentRoot: StaticElementOptions;
    readonly nodesetPrefix?: string;
}
export declare class StaticDocument extends StaticParentNode<'document'> implements XFormsXPathDocument {
    readonly rootDocument: StaticDocument;
    readonly root: StaticElement;
    readonly parent: null;
    readonly nodeset: string;
    readonly children: readonly [root: StaticElement];
    readonly childElements: readonly [root: StaticElement];
    readonly attributes: readonly StaticAttribute[];
    constructor(options: StaticDocumentOptions);
    getXPathValue(): string;
}
export {};
