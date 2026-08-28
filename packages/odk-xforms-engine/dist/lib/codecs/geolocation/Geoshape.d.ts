import { Geolocation, LocationPoint } from './Geolocation.ts';
export type GeoshapeRuntimeValue = LocationPoint[] | null;
export type GeoshapeInputValue = GeoshapeRuntimeValue | string;
export declare class Geoshape extends Geolocation {
    static parseStringToGeoshape(value: string): GeoshapeRuntimeValue;
    static parseGeoshapeString(points: GeoshapeInputValue): string;
}
