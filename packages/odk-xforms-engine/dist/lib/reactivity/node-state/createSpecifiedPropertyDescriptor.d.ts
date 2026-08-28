import { StatePropertySpec } from './createSpecifiedState.ts';
export interface SpecifiedPropertyDescriptor<T = any> extends TypedPropertyDescriptor<T> {
    readonly configurable: true;
    readonly enumerable: true;
}
export declare const createSpecifiedPropertyDescriptor: <T>(propertySpec: StatePropertySpec<T>) => SpecifiedPropertyDescriptor<T>;
