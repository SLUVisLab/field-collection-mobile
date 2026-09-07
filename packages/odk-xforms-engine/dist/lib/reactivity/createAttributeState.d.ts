import { Accessor, Setter, Signal } from 'solid-js';
import { Attribute } from '../../instance/Attribute.ts';
import { ReactiveScope } from './scope.ts';
export interface AttributeState {
    readonly attributes: Signal<readonly Attribute[]>;
    readonly getAttributes: Accessor<readonly Attribute[]>;
    readonly setAttributes: Setter<readonly Attribute[]>;
}
/**
 * Creates attributes state suitable for all node types
 *
 * The produced {@link AttributeState.attributes} (and its get/set convenience
 * methods) signal is intended to be used to store the engine's attribute state,
 * and update that state when appropriate.
 */
export declare const createAttributeState: (scope: ReactiveScope) => AttributeState;
