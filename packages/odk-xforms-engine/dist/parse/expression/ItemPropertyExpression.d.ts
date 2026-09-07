import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { DependentExpression } from './abstract/DependentExpression.ts';
export declare class ItemPropertyExpression extends DependentExpression<'string'> {
    static from(propertiesNodes: StaticElement[]): ItemPropertyExpression[];
    constructor(propertyName: string);
}
