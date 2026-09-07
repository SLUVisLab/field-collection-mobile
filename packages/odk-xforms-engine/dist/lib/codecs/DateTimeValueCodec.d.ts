import { Temporal } from 'temporal-polyfill';
import { ValueCodec } from './ValueCodec.ts';
export type DateTimeRuntimeValue = string | null;
export type DateTimeInputValue = Date | Temporal.PlainDateTime | Temporal.ZonedDateTime | string | null;
export declare class DateTimeValueCodec extends ValueCodec<'dateTime', DateTimeRuntimeValue, DateTimeInputValue> {
    constructor();
}
