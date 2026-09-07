import { Accessor } from 'solid-js';
import { BaseItem } from '../../client/BaseItem.ts';
import { RankControl } from '../../instance/RankControl.ts';
import { SelectControl } from '../../instance/SelectControl.ts';
type ItemCollectionControl = RankControl | SelectControl;
/**
 * Creates a reactive computation of a {@link ItemCollectionControl}'s
 * {@link BaseItem}s, in support of the field's `valueOptions`.
 *
 * - The control defined with static `<item>`s will compute to an corresponding
 *   static list of items.
 * - The control defined with a computed `<itemset>` will compute to a reactive list
 *   of items.
 * - Items of both will produce {@link ItemType.label | labels} reactive to
 *   their appropriate dependencies (whether relative to the itemset item node,
 *   referencing a form's `itext` translations, etc).
 */
export declare const createItemCollection: (control: ItemCollectionControl) => Accessor<readonly BaseItem[]>;
export {};
