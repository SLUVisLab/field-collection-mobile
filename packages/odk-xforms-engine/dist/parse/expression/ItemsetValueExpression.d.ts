import { ItemsetDefinition } from '../body/control/ItemsetDefinition.ts';
import { DependentExpression } from './abstract/DependentExpression.ts';
export declare class ItemsetValueExpression extends DependentExpression<'string'> {
    readonly itemset: ItemsetDefinition;
    constructor(itemset: ItemsetDefinition, expression: string);
}
