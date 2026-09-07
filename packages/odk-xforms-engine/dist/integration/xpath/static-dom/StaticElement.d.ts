import { QualifiedNameSource, QualifiedName } from '../../../lib/names/QualifiedName.ts';
import { XFormsXPathElement } from '../adapter/XFormsXPathNode.ts';
import { StaticAttributeOptions, StaticAttribute } from './StaticAttribute.ts';
import { StaticDocument } from './StaticDocument.ts';
import { StaticChildNode } from './StaticNode.ts';
import { StaticParentNode } from './StaticParentNode.ts';
export type StaticElementChildOption = StaticElementOptions | string;
export interface StaticElementOptions {
    readonly name: QualifiedNameSource | string;
    readonly attributes?: readonly StaticAttributeOptions[];
    readonly children?: readonly StaticElementChildOption[];
}
export declare class StaticElement extends StaticParentNode<'element'> implements XFormsXPathElement {
    readonly parent: StaticDocument | StaticElement;
    private computedValue;
    readonly rootDocument: StaticDocument;
    readonly root: StaticElement;
    readonly qualifiedName: QualifiedName;
    readonly nodeset: string;
    readonly attributes: readonly StaticAttribute[];
    readonly children: readonly StaticChildNode[];
    readonly childElements: readonly StaticElement[];
    readonly value: string | null;
    constructor(parent: StaticDocument | StaticElement, options: StaticElementOptions);
    isLeafElement(): this is StaticLeafElement;
    assertLeafElement(): asserts this is StaticLeafElement;
    /**
     * @todo Generalize this, incorporate into {@link EngineDOMAdapter}
     * @todo Namespaced lookup
     * @todo Optimize: lookup from map and/or caching
     */
    protected getAttributeNode(localName: string): StaticAttribute | null;
    /**
     * @todo Generalize this, incorporate into {@link EngineDOMAdapter}
     * @todo Namespaced lookup
     * @todo Optimize: lookup from map and/or caching (especially asserting known
     * attributes!)
     * @todo As long as this depends on {@link getAttributeNode}, push assertion
     * up. (This was put off because the types are already plenty complex as it
     * is.)
     */
    getAttributeValue(localName: string): string | null;
    getXPathValue(): string;
}
export interface StaticLeafElement extends StaticElement {
    readonly value: string;
}
