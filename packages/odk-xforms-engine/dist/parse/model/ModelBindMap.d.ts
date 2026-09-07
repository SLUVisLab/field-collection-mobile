import { XFormDefinition } from '../XFormDefinition.ts';
import { BindDefinition } from './BindDefinition.ts';
import { BindNodeset } from './BindElement.ts';
import { ModelDefinition } from './ModelDefinition.ts';
type TopologicalSortIndex = number;
export type SortedNodesetIndexes = ReadonlyMap<BindNodeset, TopologicalSortIndex>;
export declare class ModelBindMap extends Map<BindNodeset, BindDefinition> {
    protected readonly form: XFormDefinition;
    protected readonly model: ModelDefinition;
    static fromModel(model: ModelDefinition): ModelBindMap;
    protected constructor(form: XFormDefinition, model: ModelDefinition);
    getOrCreateBindDefinition(nodeset: string): BindDefinition;
    toJSON(): [string, BindDefinition<"string" | "boolean" | "time" | "int" | "decimal" | "date" | "dateTime" | "geopoint" | "geotrace" | "geoshape" | "binary" | "barcode" | "intent">][];
}
export {};
