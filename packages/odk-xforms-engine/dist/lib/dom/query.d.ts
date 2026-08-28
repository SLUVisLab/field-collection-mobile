import { KnownAttributeLocalNamedElement, LocalNamedElement } from '../../../../common/types/dom.ts';
export interface HintElement extends LocalNamedElement<'hint'> {
}
export interface ItemElement extends LocalNamedElement<'item'> {
}
export interface ItemsetElement extends KnownAttributeLocalNamedElement<'itemset', 'nodeset'> {
}
export interface LabelElement extends LocalNamedElement<'label'> {
}
export interface RepeatGroupLabelElement extends LabelElement {
    getAttribute(name: 'form-definition-source'): 'repeat-group';
    getAttribute(name: string): string;
}
export interface RepeatElement extends KnownAttributeLocalNamedElement<'repeat', 'nodeset'> {
}
export interface ValueElement extends LocalNamedElement<'value'> {
}
export declare const getHintElement: (parent: Element) => HintElement | null;
export declare const getItemElements: (parent: Element) => readonly ItemElement[];
export declare const getItemsetElement: (parent: Element) => ItemsetElement | null;
export declare const getLabelElement: (parent: Element) => LabelElement | null;
export declare const getRepeatGroupLabelElement: (parent: Element) => RepeatGroupLabelElement | null;
export declare const getRepeatElement: (parent: Element) => RepeatElement | null;
export declare const getValueElement: (parent: ItemElement | ItemsetElement) => ValueElement | null;
export interface SubmissionElement extends LocalNamedElement<'submission'> {
}
export declare const getSubmissionElement: (parent: Element) => SubmissionElement | null;
