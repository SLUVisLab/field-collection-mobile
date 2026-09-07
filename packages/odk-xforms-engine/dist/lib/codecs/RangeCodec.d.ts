import { RangeNodeDefinition, RangeValueType } from '../../parse/model/RangeNodeDefinition.ts';
import { RuntimeInputValue, RuntimeValue, SharedValueCodec } from './getSharedValueCodec.ts';
import { ValueCodec } from './ValueCodec.ts';
export type RangeRuntimeValue<V extends RangeValueType> = RuntimeValue<V>;
export type RangeInputValue<V extends RangeValueType> = RuntimeInputValue<V>;
export declare class RangeCodec<V extends RangeValueType> extends ValueCodec<V, RangeRuntimeValue<V>, RangeInputValue<V>> {
    constructor(baseCodec: SharedValueCodec<V>, definition: RangeNodeDefinition<V>);
}
