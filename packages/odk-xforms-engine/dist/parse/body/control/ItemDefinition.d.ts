import { ItemElement } from '../../../lib/dom/query.ts';
import { ItemLabelDefinition } from '../../text/ItemLabelDefinition.ts';
import { XFormDefinition } from '../../XFormDefinition.ts';
import { BodyElementDefinition } from '../BodyElementDefinition.ts';
import { AnySelectControlDefinition } from './SelectControlDefinition.ts';
import { RankControlDefinition } from './RankControlDefinition.ts';
export declare class ItemDefinition extends BodyElementDefinition<'item'> {
    readonly parent: AnySelectControlDefinition | RankControlDefinition;
    readonly category = "support";
    readonly type = "item";
    readonly label: ItemLabelDefinition | null;
    readonly value: string;
    constructor(form: XFormDefinition, parent: AnySelectControlDefinition | RankControlDefinition, element: ItemElement);
}
