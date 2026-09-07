import { StaticElement } from '../../../integration/xpath/static-dom/StaticElement.ts';
import { ItemsetElement } from '../../../lib/dom/query.ts';
import { DependentExpression } from '../../expression/abstract/DependentExpression.ts';
import { ItemsetNodesetExpression } from '../../expression/ItemsetNodesetExpression.ts';
import { ItemsetValueExpression } from '../../expression/ItemsetValueExpression.ts';
import { ItemsetLabelDefinition } from '../../text/ItemsetLabelDefinition.ts';
import { XFormDefinition } from '../../XFormDefinition.ts';
import { BodyElementDefinition } from '../BodyElementDefinition.ts';
import { RankControlDefinition } from './RankControlDefinition.ts';
import { AnySelectControlDefinition } from './SelectControlDefinition.ts';
export declare class ItemsetDefinition extends BodyElementDefinition<'itemset'> {
    readonly parent: AnySelectControlDefinition | RankControlDefinition;
    readonly category = "support";
    readonly type = "itemset";
    readonly reference: string;
    readonly label: ItemsetLabelDefinition | null;
    readonly nodes: ItemsetNodesetExpression;
    readonly value: ItemsetValueExpression;
    constructor(form: XFormDefinition, parent: AnySelectControlDefinition | RankControlDefinition, element: ItemsetElement);
    getPropertiesExpressions(propertiesNodes: StaticElement[]): Array<DependentExpression<'string'>>;
}
