import { ValueType } from '../../client/ValueType.ts';
import { StaticLeafElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { RuntimeValue } from '../../lib/codecs/getSharedValueCodec.ts';
import { RangeControlBoundsDefinition, RangeControlDefinition } from '../body/control/RangeControlDefinition.ts';
import { BindDefinition } from './BindDefinition.ts';
import { LeafNodeDefinition } from './LeafNodeDefinition.ts';
import { ModelDefinition } from './ModelDefinition.ts';
import { ParentNodeDefinition } from './NodeDefinition.ts';
declare const RANGE_VALUE_TYPES: readonly ["decimal", "int"];
export type RangeValueType = (typeof RANGE_VALUE_TYPES)[number];
export interface RangeLeafNodeDefinition<V extends ValueType = ValueType> extends LeafNodeDefinition<V> {
    readonly bodyElement: RangeControlDefinition;
}
declare class RangeNodeBoundsDefinition<V extends RangeValueType = RangeValueType> {
    readonly start: NonNullable<RuntimeValue<V>>;
    readonly end: NonNullable<RuntimeValue<V>>;
    readonly step: NonNullable<RuntimeValue<V>>;
    static from<V extends RangeValueType>(bounds: RangeControlBoundsDefinition, bind: BindDefinition<V>): RangeNodeBoundsDefinition<V>;
    constructor(start: NonNullable<RuntimeValue<V>>, end: NonNullable<RuntimeValue<V>>, step: NonNullable<RuntimeValue<V>>);
}
/**
 * @todo We should really consider making `LeafNodeDefinition` an abstract base
 * class, and each node's definition an explicit concrete subclass of that. It
 * would simplify a lot of things, reduce redundancy (and drift!) between
 * various like `*Definition` types, and allow us to reason more clearly about
 * what parse-product-input is used to construct each primary instance node.
 * Furthermore, it would give us a great deal more flexibility to revisit some
 * of the weaker parts of our current data model (e.g. splitting up selects).
 *
 * I explored this refactor as part of the prerequisite work to support range
 * controls. I eventually backed out because it involved more churn than I felt
 * comfortable with, but I do think we should keep an eye out for other
 * opportunities to take on the churn.
 */
export declare class RangeNodeDefinition<V extends RangeValueType = RangeValueType> extends LeafNodeDefinition<V> implements RangeLeafNodeDefinition<V> {
    readonly bind: BindDefinition<V>;
    readonly bodyElement: RangeControlDefinition;
    static from<V extends ValueType>(model: ModelDefinition, parent: ParentNodeDefinition, bind: BindDefinition<V>, bodyElement: RangeControlDefinition, node: StaticLeafElement): RangeNodeDefinition<Extract<V, RangeValueType>>;
    readonly bounds: RangeNodeBoundsDefinition<V>;
    private constructor();
}
export type AnyRangeNodeDefinition = RangeNodeDefinition<'decimal'> | RangeNodeDefinition<'int'>;
export {};
