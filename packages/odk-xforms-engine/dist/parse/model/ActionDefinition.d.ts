import { ActionComputationExpression } from '../expression/ActionComputationExpression.ts';
import { XFormEvent } from './Event.ts';
import { ModelDefinition } from './ModelDefinition.ts';
export type ActionType = 'geopoint' | 'value';
export declare class ActionDefinition {
    static getRef(model: ModelDefinition, element: Element): string | null;
    static getValue(element: Element): string;
    static isKnownEvent: (event: XFormEvent) => event is XFormEvent;
    static getEvents(element: Element): XFormEvent[];
    readonly ref: string;
    readonly events: XFormEvent[];
    readonly computation: ActionComputationExpression<'string'>;
    readonly source: string | undefined;
    readonly type: ActionType;
    constructor(model: ModelDefinition, element: Element, source?: string);
}
