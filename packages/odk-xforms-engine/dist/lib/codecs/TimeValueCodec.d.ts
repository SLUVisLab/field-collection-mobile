import { Temporal } from 'temporal-polyfill';
import { ValueCodec } from './ValueCodec.ts';
export type TimeRuntimeValue = string | null;
export type TimeInputValue = Date | Temporal.PlainDateTime | Temporal.PlainTime | Temporal.ZonedDateTime | string | null;
export declare class TimeValueCodec extends ValueCodec<'time', TimeRuntimeValue, TimeInputValue> {
    constructor();
}
