import { XPathNodeKindKey } from '@getodk/xpath';
import { XFormsXPathNode } from '../adapter/XFormsXPathNode.ts';
import { StaticAttribute } from './StaticAttribute.ts';
import { StaticDocument } from './StaticDocument.ts';
import { StaticElement } from './StaticElement.ts';
import { StaticText } from './StaticText.ts';
export type StaticNodeKind = 'document' | 'element' | 'attribute' | 'text';
export type StaticNodeType<Kind extends StaticNodeKind> = `static-${Kind}`;
export declare abstract class StaticNode<Kind extends StaticNodeKind> implements XFormsXPathNode {
    abstract readonly [XPathNodeKindKey]: Kind;
    abstract readonly nodeType: StaticNodeType<Kind>;
    /**
     * A concrete {@link StaticDocument} instance, representing the topmost node
     * of a static document tree, containing all of:
     *
     * - {@link root}
     * - {@link children}
     * - any {@link StaticChildNode} descendants of either of the above
     */
    abstract readonly rootDocument: StaticDocument;
    /**
     * A concrete {@link StaticElement} instance, representing the single,
     * immediate child of {@link rootDocument}, containing all other descendants
     * of its document tree.
     */
    abstract readonly root: StaticElement;
    abstract readonly children: readonly StaticChildNode[] | null;
    getXPathChildNodes(): readonly StaticChildNode[];
    abstract getXPathValue(): string;
}
export type AnyStaticNode = StaticDocument | StaticElement | StaticAttribute | StaticText;
export type StaticNodeParent = StaticDocument | StaticElement;
export type StaticChildNode = StaticElement | StaticText;
