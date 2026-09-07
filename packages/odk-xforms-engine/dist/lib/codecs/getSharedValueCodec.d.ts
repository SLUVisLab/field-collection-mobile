import { ValueType } from '../../client/ValueType.ts';
import { DatetimeInputValue, DatetimeRuntimeValue } from './DateValueCodec.ts';
import { DateTimeInputValue, DateTimeRuntimeValue } from './DateTimeValueCodec.ts';
import { DecimalInputValue, DecimalRuntimeValue } from './DecimalValueCodec.ts';
import { GeopointInputValue, GeopointRuntimeValue } from './geolocation/Geopoint.ts';
import { GeoshapeInputValue, GeoshapeRuntimeValue } from './geolocation/Geoshape.ts';
import { GeotraceInputValue, GeotraceRuntimeValue } from './geolocation/Geotrace.ts';
import { IntInputValue, IntRuntimeValue } from './IntValueCodec.ts';
import { TimeInputValue, TimeRuntimeValue } from './TimeValueCodec.ts';
import { ValueCodec } from './ValueCodec.ts';
interface RuntimeValuesByType {
    readonly string: string;
    readonly int: IntRuntimeValue;
    readonly decimal: DecimalRuntimeValue;
    readonly boolean: string;
    readonly date: DatetimeRuntimeValue;
    readonly time: TimeRuntimeValue;
    readonly dateTime: DateTimeRuntimeValue;
    readonly geopoint: GeopointRuntimeValue;
    readonly geotrace: GeotraceRuntimeValue;
    readonly geoshape: GeoshapeRuntimeValue;
    readonly binary: string;
    readonly barcode: string;
    readonly intent: string;
}
export type RuntimeValue<V extends ValueType> = RuntimeValuesByType[V];
interface RuntimeInputValuesByType {
    readonly string: string;
    readonly int: IntInputValue;
    readonly decimal: DecimalInputValue;
    readonly boolean: string;
    readonly date: DatetimeInputValue;
    readonly time: TimeInputValue;
    readonly dateTime: DateTimeInputValue;
    readonly geopoint: GeopointInputValue;
    readonly geotrace: GeotraceInputValue;
    readonly geoshape: GeoshapeInputValue;
    readonly binary: string;
    readonly barcode: string;
    readonly intent: string;
}
export type RuntimeInputValue<V extends ValueType> = RuntimeInputValuesByType[V];
type SharedValueCodecs = {
    readonly [V in ValueType]: ValueCodec<V, RuntimeValue<V>, RuntimeInputValue<V>>;
};
export type SharedValueCodec<V extends ValueType> = SharedValueCodecs[V];
/**
 * Provides codecs for each {@link ValueType | value type}, for nodes with a
 * common representation of those value types.
 */
export declare const sharedValueCodecs: SharedValueCodecs;
export declare const getSharedValueCodec: <V extends ValueType>(valueType: V) => SharedValueCodec<V>;
export {};
