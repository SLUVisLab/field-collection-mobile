import { ValueType } from '../../client/ValueType.ts';
import { RuntimeValue, SharedValueCodec } from './getSharedValueCodec.ts';
import { CodecDecoder, CodecEncoder, ValueCodec } from './ValueCodec.ts';
export type SplitInstanceValues = (value: string) => readonly string[];
export type JoinInstnaceValues = (values: readonly string[]) => string;
export type RuntimeItemValue<V extends ValueType> = NonNullable<RuntimeValue<V>>;
export type RuntimeValues<V extends ValueType> = ReadonlyArray<RuntimeItemValue<V>>;
export declare abstract class ValueArrayCodec<V extends ValueType, Values extends RuntimeValues<V> = RuntimeValues<V>> extends ValueCodec<V, Values, Values> {
    readonly decodeItemValue: CodecDecoder<RuntimeItemValue<V>>;
    constructor(baseCodec: SharedValueCodec<V>, encodeValue: CodecEncoder<Values>, decodeValue: CodecDecoder<Values>);
}
