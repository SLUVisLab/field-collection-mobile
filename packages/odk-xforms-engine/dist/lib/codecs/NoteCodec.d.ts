import { ValueType } from '../../client/ValueType.ts';
import { RuntimeInputValue, RuntimeValue, SharedValueCodec } from './getSharedValueCodec.ts';
import { ValueCodec } from './ValueCodec.ts';
export type NoteRuntimeValue<V extends ValueType> = RuntimeValue<V> | null;
export type NoteInputValue<V extends ValueType> = RuntimeInputValue<V> | RuntimeValue<V> | null;
export declare class NoteCodec<V extends ValueType> extends ValueCodec<V, NoteRuntimeValue<V>, NoteInputValue<V>> {
    constructor(baseCodec: SharedValueCodec<V>);
}
