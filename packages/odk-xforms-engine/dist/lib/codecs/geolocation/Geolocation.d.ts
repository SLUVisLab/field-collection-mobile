declare abstract class SemanticValue<Semantic extends string, Value extends number | null> {
    readonly value: Value;
    abstract readonly semantic: Semantic;
    constructor(value: Value);
}
declare class Latitude extends SemanticValue<'latitude', number> {
    readonly semantic = "latitude";
}
declare class Longitude extends SemanticValue<'longitude', number> {
    readonly semantic = "longitude";
}
declare class Altitude<Value extends number | null = number> extends SemanticValue<'altitude', Value> {
    readonly semantic = "altitude";
}
declare class Accuracy<Value extends number | null = number> extends SemanticValue<'accuracy', Value> {
    readonly semantic = "accuracy";
}
export interface LocationPointInput {
    readonly latitude: number;
    readonly longitude: number;
    readonly altitude?: number | null;
    readonly accuracy?: number | null;
}
export interface LocationPoint {
    readonly latitude: number;
    readonly longitude: number;
    readonly altitude: number;
    readonly accuracy: number;
}
type LocationPointTuple = readonly [
    latitude: Latitude,
    longitude: Longitude,
    altitude: Altitude,
    accuracy: Accuracy
];
export declare const SEGMENT_SEPARATOR = ";";
export declare class Geolocation {
    private readonly internalValue;
    constructor(coordinates: LocationPointInput);
    getTuple(): LocationPointTuple;
    getRuntimeValue(): LocationPoint | null;
    private isValidDegrees;
    private isValidNumber;
    private static isNullLocation;
    static parseString(value: string): LocationPoint | null;
    static toCoordinatesString(value: LocationPointInput | string | null): string;
    static isClosedShape(points: LocationPoint[]): boolean;
    static getSegments(value: string): string[] | null;
}
export {};
