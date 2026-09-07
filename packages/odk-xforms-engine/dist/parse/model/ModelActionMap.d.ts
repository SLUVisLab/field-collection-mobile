import { ActionDefinition } from './ActionDefinition.ts';
import { ModelDefinition } from './ModelDefinition.ts';
export declare class ModelActionMap extends Map<string, ActionDefinition[]> {
    static fromModel(model: ModelDefinition): ModelActionMap;
    static getKey(ref: string): string;
    protected constructor(model: ModelDefinition);
    get(ref: string): ActionDefinition[] | undefined;
    private addAll;
    add(action: ActionDefinition): void;
}
