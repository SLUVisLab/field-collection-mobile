import { Geolocation, LocationPoint, LocationPointInput } from './Geolocation.ts';
export type GeopointRuntimeValue = LocationPoint | null;
export type GeopointInputValue = LocationPointInput | string | null;
export declare class Geopoint extends Geolocation {
    static parseStringToGeopoint(value: string): GeopointRuntimeValue;
    static parseGeopointToString(value: GeopointInputValue): string;
}
