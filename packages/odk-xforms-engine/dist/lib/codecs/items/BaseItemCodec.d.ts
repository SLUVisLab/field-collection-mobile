import { ValueType } from '../../../client/ValueType.ts';
import { SharedValueCodec } from '../getSharedValueCodec.ts';
import { ValueArrayCodec } from '../ValueArrayCodec.ts';
import { CodecDecoder, CodecEncoder } from '../ValueCodec.ts';
export type BaseItemValueType = 'string';
export type UnsupportedBaseItemValueType = Exclude<ValueType, BaseItemValueType>;
export declare abstract class BaseItemCodec<Values extends readonly string[] = readonly string[]> extends ValueArrayCodec<BaseItemValueType, Values> {
    constructor(baseCodec: SharedValueCodec<'string'>, encodeValue: CodecEncoder<Values>, decodeValue: CodecDecoder<Values>);
}
