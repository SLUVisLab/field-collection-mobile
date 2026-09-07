import { ValueType } from '../../../client';
import { CodecDecoder, CodecEncoder, ValueCodec } from '../ValueCodec.ts';
export declare function createGeolocationValueCodec<V extends ValueType, RuntimeValue extends RuntimeInputValue, RuntimeInputValue = RuntimeValue>(valueType: V, encodeValue: CodecEncoder<RuntimeInputValue>, decodeValue: CodecDecoder<RuntimeValue>): ValueCodec<V, RuntimeValue, RuntimeInputValue>;
