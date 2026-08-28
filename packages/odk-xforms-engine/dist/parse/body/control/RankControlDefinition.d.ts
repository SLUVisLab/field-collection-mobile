import { XFormDefinition } from '../../XFormDefinition.ts';
import { BodyElementParentContext } from '../BodyDefinition.ts';
import { ControlDefinition } from './ControlDefinition.ts';
import { ItemsetDefinition } from './ItemsetDefinition.ts';
import { ItemDefinition } from './ItemDefinition.ts';
import { UnknownAppearanceDefinition } from '../appearance/unknownAppearanceParser.ts';
export declare class RankControlDefinition extends ControlDefinition<'rank'> {
    static isCompatible(localName: string): boolean;
    readonly type = "rank";
    readonly appearances: UnknownAppearanceDefinition;
    readonly itemset: ItemsetDefinition | null;
    readonly items: readonly ItemDefinition[];
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
    toJSON(): {};
}
