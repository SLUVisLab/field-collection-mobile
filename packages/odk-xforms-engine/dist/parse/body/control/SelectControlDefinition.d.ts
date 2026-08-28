import { CollectionValues } from '../../../../../common/types/collections/CollectionValues.ts';
import { LocalNamedElement } from '../../../../../common/types/dom.ts';
import { XFormDefinition } from '../../XFormDefinition.ts';
import { SelectAppearanceDefinition } from '../appearance/selectAppearanceParser.ts';
import { AnyBodyElementDefinition, BodyElementParentContext } from '../BodyDefinition.ts';
import { ControlDefinition } from './ControlDefinition.ts';
import { ItemDefinition } from './ItemDefinition.ts';
import { ItemsetDefinition } from './ItemsetDefinition.ts';
declare const selectLocalNames: Set<"select" | "select1">;
export type SelectType = CollectionValues<typeof selectLocalNames>;
export interface SelectElement extends LocalNamedElement<SelectType> {
}
export declare class SelectControlDefinition<Type extends SelectType> extends ControlDefinition<Type> {
    static isCompatible(localName: string, element: Element): boolean;
    static isSelect(element: AnyBodyElementDefinition): element is AnySelectControlDefinition;
    readonly type: Type;
    readonly element: SelectElement;
    readonly appearances: SelectAppearanceDefinition;
    readonly itemset: ItemsetDefinition | null;
    readonly items: readonly ItemDefinition[];
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
    toJSON(): {};
}
export type AnySelectControlDefinition = SelectControlDefinition<SelectType>;
export {};
