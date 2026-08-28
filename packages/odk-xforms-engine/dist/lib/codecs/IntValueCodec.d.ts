import { ValueCodec } from './ValueCodec.ts';
export type IntInputValue = bigint | number | string | null;
export type IntRuntimeValue = bigint | null;
export declare class IntValueCodec extends ValueCodec<'int', IntRuntimeValue, IntInputValue> {
    constructor();
}
