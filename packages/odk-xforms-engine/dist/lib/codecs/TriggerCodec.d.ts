import { ValueCodec } from './ValueCodec.ts';
export type TriggerValueType = 'string';
export type TriggerRuntimeValue = boolean;
export type TriggerInputValue = boolean | '' | null;
export declare class TriggerCodec extends ValueCodec<TriggerValueType, TriggerRuntimeValue, TriggerInputValue> {
    constructor();
}
