import { ShallowMutable } from '../../../../../common/types/helpers.js';
declare const ENGINE_REPRESENTATION: unique symbol;
type ENGINE_REPRESENTATION = typeof ENGINE_REPRESENTATION;
declare const INTERNAL_CLIENT_REPRESENTATION: unique symbol;
type INTERNAL_CLIENT_REPRESENTATION = typeof INTERNAL_CLIENT_REPRESENTATION;
declare const READONLY_CLIENT_REPRESENTATION: unique symbol;
type READONLY_CLIENT_REPRESENTATION = typeof READONLY_CLIENT_REPRESENTATION;
type RepresentationType = ENGINE_REPRESENTATION | INTERNAL_CLIENT_REPRESENTATION | READONLY_CLIENT_REPRESENTATION;
type TypedRepresentation<Type extends RepresentationType, T> = T & {
    readonly [K in RepresentationType]?: K extends Type ? K : never;
};
export type EngineRepresentation<T extends object> = TypedRepresentation<ENGINE_REPRESENTATION, ShallowMutable<T>>;
export declare const declareEngineRepresentation: <T extends object>(stateObject: T) => EngineRepresentation<T>;
export type InternalClientRepresentation<T extends object> = TypedRepresentation<INTERNAL_CLIENT_REPRESENTATION, ShallowMutable<T>>;
export declare const declareInternalClientRepresentation: <T extends object>(stateObject: T) => InternalClientRepresentation<T>;
export type ReadonlyClientRepresentation<T> = TypedRepresentation<READONLY_CLIENT_REPRESENTATION, T>;
/**
 * Provides a static type mechanism to reduce the chance of mistakenly assigning
 * one state representation to another (e.g. `engineState = clientState` or
 * `doSomethingWithCurrentState(engineState)`). Each representation is either
 * fully or partially assignable to the other, but this bit of indirection should
 * prevent that (unless one of the types is widened to {@link T}).
 */
export declare const declareReadonlyClientRepresentation: <T extends object>(stateObject: Readonly<T>) => ReadonlyClientRepresentation<T>;
export {};
