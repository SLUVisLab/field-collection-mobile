import { XFormDefinition } from '../XFormDefinition.ts';
import { BindElement } from './BindElement.ts';
/**
 * As specified by {@link https://getodk.github.io/xforms-spec/#data-types}
 */
declare const BIND_TYPES: readonly ["string", "int", "boolean", "decimal", "date", "time", "dateTime", "geopoint", "geotrace", "geoshape", "binary", "barcode", "intent"];
type BindTypes = typeof BIND_TYPES;
export type BindType = BindTypes[number];
export declare class BindTypeDefinition<T extends BindType = BindType> {
    readonly source: string | null;
    readonly resolved: T;
    static from<T extends BindType>(form: XFormDefinition, nodeset: string, bindElement: BindElement): BindTypeDefinition<T>;
    private constructor();
}
export {};
