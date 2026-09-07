import { Accessor } from 'solid-js';
import { ValueType } from '../../client/ValueType.ts';
import { DecodeInstanceValue } from '../../instance/internal-api/InstanceValueContext.ts';
import { SimpleAtomicState } from '../reactivity/types.ts';
export type CodecEncoder<RuntimeInputValue> = (input: RuntimeInputValue) => string;
export type CodecDecoder<RuntimeValue> = (value: string) => RuntimeValue;
type RuntimeValueAccessor<RuntimeValue> = Accessor<RuntimeValue>;
export type RuntimeValueSetter<RuntimeValue extends RuntimeInputValue, RuntimeInputValue = RuntimeValue> = (input: RuntimeInputValue) => RuntimeValue;
export type RuntimeValueState<RuntimeValue extends RuntimeInputValue, RuntimeInputValue = RuntimeValue> = readonly [
    get: RuntimeValueAccessor<RuntimeValue>,
    set: RuntimeValueSetter<RuntimeValue, RuntimeInputValue>
];
export type CreateRuntimeValueState<RuntimeValue extends RuntimeInputValue, RuntimeInputValue = RuntimeValue> = (instanceState: SimpleAtomicState<string>) => RuntimeValueState<RuntimeValue, RuntimeInputValue>;
type RuntimeValueStateFactory<RuntimeValue extends RuntimeInputValue, RuntimeInputValue = RuntimeValue> = (encodeValue: CodecEncoder<RuntimeInputValue>, decodeValue: CodecDecoder<RuntimeValue>) => CreateRuntimeValueState<RuntimeValue, RuntimeInputValue>;
type DecodeInstanceValueFactory<RuntimeValue extends RuntimeInputValue, RuntimeInputValue = RuntimeValue> = (encodeValue: CodecEncoder<RuntimeInputValue>, decodeValue: CodecDecoder<RuntimeValue>) => DecodeInstanceValue;
interface ValueCodecOptions<RuntimeValue extends RuntimeInputValue, RuntimeInputValue> {
    readonly decodeInstanceValueFactory?: DecodeInstanceValueFactory<RuntimeValue, RuntimeInputValue>;
    readonly runtimeValueStateFactory?: RuntimeValueStateFactory<RuntimeValue, RuntimeInputValue>;
}
export declare abstract class ValueCodec<V extends ValueType, RuntimeValue extends RuntimeInputValue, RuntimeInputValue = RuntimeValue> {
    readonly valueType: V;
    readonly encodeValue: CodecEncoder<RuntimeInputValue>;
    readonly decodeValue: CodecDecoder<RuntimeValue>;
    protected readonly defaultRuntimeValueStateFactory: RuntimeValueStateFactory<RuntimeValue, RuntimeInputValue>;
    protected readonly defaultDecodeInstanceValueFactory: DecodeInstanceValueFactory<RuntimeValue, RuntimeInputValue>;
    readonly decodeInstanceValue: DecodeInstanceValue;
    readonly createRuntimeValueState: CreateRuntimeValueState<RuntimeValue, RuntimeInputValue>;
    constructor(valueType: V, encodeValue: CodecEncoder<RuntimeInputValue>, decodeValue: CodecDecoder<RuntimeValue>, options?: ValueCodecOptions<RuntimeValue, RuntimeInputValue>);
}
export {};
