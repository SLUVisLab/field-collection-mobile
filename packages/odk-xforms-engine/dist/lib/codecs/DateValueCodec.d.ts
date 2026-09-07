import { Temporal } from 'temporal-polyfill';
import { ValueCodec } from './ValueCodec.ts';
export type DatetimeRuntimeValue = Temporal.PlainDate | null;
export type DatetimeInputValue = Date | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime | string | null;
export declare class DateValueCodec extends ValueCodec<'date', DatetimeRuntimeValue, DatetimeInputValue> {
    constructor();
}
