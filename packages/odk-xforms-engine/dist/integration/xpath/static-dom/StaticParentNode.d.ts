import { XPathNodeKindKey } from '@getodk/xpath';
import { StaticElement } from './StaticElement.ts';
import { StaticNode, StaticChildNode } from './StaticNode.ts';
type StaticParentNodeKind = 'document' | 'element';
type StaticParentNodeType<Kind extends StaticParentNodeKind> = `static-${Kind}`;
export declare abstract class StaticParentNode<Kind extends StaticParentNodeKind> extends StaticNode<Kind> {
    abstract readonly children: readonly StaticChildNode[];
    abstract readonly childElements: readonly StaticElement[];
    readonly [XPathNodeKindKey]: Kind;
    readonly nodeType: StaticParentNodeType<Kind>;
    constructor(kind: Kind);
}
export {};
