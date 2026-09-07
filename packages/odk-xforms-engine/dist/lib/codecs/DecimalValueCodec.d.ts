import { ValueCodec } from './ValueCodec.ts';
export type DecimalInputValue = bigint | number | string | null;
export type DecimalRuntimeValue = number | null;
export declare class DecimalValueCodec extends ValueCodec<'decimal', DecimalRuntimeValue, DecimalInputValue> {
    constructor();
}
