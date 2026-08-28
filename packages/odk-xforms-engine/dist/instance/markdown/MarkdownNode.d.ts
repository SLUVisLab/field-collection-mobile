import { AnchorMarkdownNode, ChildMarkdownNode as ClientChildMarkdownNode, HtmlMarkdownNode as ClientHtmlMarkdownNode, MarkdownNode as ClientMarkdownNode, ParentMarkdownNode as ClientParentMarkdownNode, StyledMarkdownNode as ClientStyledMarkdownNode, ElementName, LineBreakMarkdownNode, MarkdownProperty } from '../../client';
declare abstract class MarkdownNode {
    readonly id: string;
    constructor();
}
declare abstract class ParentMarkdownNode extends MarkdownNode implements ClientParentMarkdownNode {
    readonly children: ClientMarkdownNode[];
    readonly role = "parent";
    abstract elementName: ElementName;
    constructor(children: ClientMarkdownNode[]);
}
export declare class Heading1 extends ParentMarkdownNode {
    readonly elementName = "h1";
}
export declare class Heading2 extends ParentMarkdownNode {
    readonly elementName = "h2";
}
export declare class Heading3 extends ParentMarkdownNode {
    readonly elementName = "h3";
}
export declare class Heading4 extends ParentMarkdownNode {
    readonly elementName = "h4";
}
export declare class Heading5 extends ParentMarkdownNode {
    readonly elementName = "h5";
}
export declare class Heading6 extends ParentMarkdownNode {
    readonly elementName = "h6";
}
export declare class Strong extends ParentMarkdownNode {
    readonly elementName = "strong";
}
export declare class Underline extends ParentMarkdownNode {
    readonly elementName = "u";
}
export declare class Emphasis extends ParentMarkdownNode {
    readonly elementName = "em";
}
export declare class OrderedList extends ParentMarkdownNode {
    readonly elementName = "ol";
}
export declare class UnorderedList extends ParentMarkdownNode {
    readonly elementName = "ul";
}
export declare class ListItem extends ParentMarkdownNode {
    readonly elementName = "li";
}
export declare class LineBreak implements LineBreakMarkdownNode {
    readonly id: string;
    readonly role = "line-break";
    readonly elementName = "br";
    constructor();
}
export declare class Anchor extends ParentMarkdownNode implements AnchorMarkdownNode {
    readonly elementName = "a";
    readonly url: string;
    constructor(children: ClientMarkdownNode[], url: string);
}
declare abstract class StyledMarkdownNode implements ClientParentMarkdownNode {
    readonly id: string;
    readonly children: ClientMarkdownNode[];
    readonly role = "parent";
    abstract elementName: ElementName;
    readonly properties: MarkdownProperty | undefined;
    constructor(children: ClientMarkdownNode[], properties: MarkdownProperty | undefined);
}
export declare class Paragraph extends StyledMarkdownNode implements ClientStyledMarkdownNode {
    readonly elementName = "p";
}
export declare class Span extends StyledMarkdownNode implements ClientStyledMarkdownNode {
    readonly elementName = "span";
}
export declare class Div extends StyledMarkdownNode implements ClientStyledMarkdownNode {
    readonly elementName = "div";
}
export declare class ChildMarkdownNode extends MarkdownNode implements ClientChildMarkdownNode {
    readonly role = "child";
    readonly value: string;
    constructor(value: string);
}
export declare class Html extends MarkdownNode implements ClientHtmlMarkdownNode {
    readonly role = "html";
    readonly unsafeHtml: string;
    constructor(unsafeHtml: string);
}
export {};
