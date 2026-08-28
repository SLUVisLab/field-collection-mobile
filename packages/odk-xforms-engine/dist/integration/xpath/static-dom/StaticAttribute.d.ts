import { XPathNodeKindKey } from '@getodk/xpath';
import { QualifiedName } from '../../../lib/names/QualifiedName.ts';
import { XFormsXPathAttribute } from '../adapter/XFormsXPathNode.ts';
import { StaticDocument } from './StaticDocument.ts';
import { StaticElement } from './StaticElement.ts';
import { StaticNode } from './StaticNode.ts';
import { StaticNodeNameSource } from './staticNodeName.ts';
export interface StaticAttributeOptions {
    readonly name: StaticNodeNameSource;
    readonly value: string;
}
export declare class StaticAttribute extends StaticNode<'attribute'> implements XFormsXPathAttribute {
    readonly parent: StaticElement;
    readonly [XPathNodeKindKey] = "attribute";
    readonly nodeType = "static-attribute";
    readonly rootDocument: StaticDocument;
    readonly root: StaticElement;
    readonly qualifiedName: QualifiedName;
    readonly nodeset: string;
    readonly attributes: readonly [];
    readonly children: null;
    readonly childElements: never[];
    readonly value: string;
    constructor(parent: StaticElement, options: StaticAttributeOptions);
    getXPathValue(): string;
}
