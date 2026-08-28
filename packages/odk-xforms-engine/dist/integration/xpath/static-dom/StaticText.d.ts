import { XPathNodeKindKey } from '@getodk/xpath';
import { XFormsXPathText } from '../adapter/XFormsXPathNode.ts';
import { StaticDocument } from './StaticDocument.ts';
import { StaticElement } from './StaticElement.ts';
import { StaticNode } from './StaticNode.ts';
export declare class StaticText extends StaticNode<'text'> implements XFormsXPathText {
    readonly parent: StaticElement;
    readonly value: string;
    readonly [XPathNodeKindKey] = "text";
    readonly nodeType = "static-text";
    readonly rootDocument: StaticDocument;
    readonly root: StaticElement;
    readonly children: null;
    constructor(parent: StaticElement, value: string);
    getXPathValue(): string;
}
