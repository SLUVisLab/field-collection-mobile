import { Geolocation, LocationPoint } from './Geolocation.ts';
export type GeotraceRuntimeValue = LocationPoint[] | null;
export type GeotraceInputValue = GeotraceRuntimeValue | string;
export declare class Geotrace extends Geolocation {
    static parseStringToGeotrace(value: string): GeotraceRuntimeValue;
    static parseGeotraceString(points: GeotraceInputValue): string;
}
