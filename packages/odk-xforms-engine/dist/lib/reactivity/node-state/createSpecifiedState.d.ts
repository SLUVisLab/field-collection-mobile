import { Accessor, Signal } from 'solid-js';
import { SimpleAtomicState } from '../types.ts';
/**
 * Specifies a state object's property as mutable. Basic usage:
 *
 * ```ts
 * import { createSignal } from 'solid-js';
 *
 * const count = createSignal(1);
 *
 * const state = createSpecifiedState({ count });
 * //    ^? { count: number }
 * ```
 *
 * While basic usage involves passing a Solid {@link Signal}, a
 * {@link SimpleAtomicState} type is also supported, allowing a slightly more
 * permissive setter type.
 *
 * @see {@link SimpleAtomicState} and its related types for more detail.
 *
 * A property specified with this type will be used to define a reactively
 * mutable property on the resulting state object where:
 *
 * - Reading the property will read its value from the provided spec's getter
 *   function, establishing an internally reactive subscription.
 *
 * - Mutating the property will pass the assigned value to the provided spec's
 *   setter function, triggering any downstream computations—whether that
 *   computation is associated with the provided spec itself, or reads from the
 *   derived property.
 *
 * - All such mutations will be propagated to any derived (client) state object.
 */
export type MutablePropertySpec<T> = SimpleAtomicState<T> | Signal<T>;
/**
 * Specifies a state object's property as reactively computed, and read-only.
 * Basic usage:
 *
 * ```ts
 * import { createMemo, createSignal } from 'solid-js';
 *
 * const [count, setCount] = createSignal(1);
 * const doubleCount = createMemo(() => count() * 2);
 *
 * const state = createSpecifiedState({ doubleCount });
 * //    ^? { readonly doubleCount: number }
 * ```
 *
 * Note: ideally, the produced type would better reflect the computed nature of
 * the resulting property. Unfortunately this isn't currently supported by the
 * TypeScript type system (by inferring the derived state type). This tradeoff
 * is reasonable for internal engine use, but should not be used to derive types
 * which will be directly consumed by clients.
 *
 * Any property specified by a thunk (zero-argument function) is supported. A
 * property specified with this type will be used to define a reactively
 * readable property on the resulting state object where:
 *
 * - Reading the property will read its value on each access, establishing an
 *   internally reactive subscription (presuming the input property spec is
 *   itself reactive).
 *
 * - Mutating the property will throw a {@link TypeError}, just as it would when
 *   attempting to mutate a normal `get` accessor.
 *
 * - Any change which would result in a reactive update in the property spec
 *   itself will be propagated to any derived (client) state object.
 */
export type ComputedPropertySpec<T> = Accessor<T>;
/**
 * @see {@link StaticPropertySpec}
 */
type NonStaticValue = Function | Signal<any> | SimpleAtomicState<any>;
/**
 * Specifies a state object's property with a static value, immutable for the
 * lifetime of that state object. Basic usage:
 *
 * ```ts
 * const state = createSpecifiedState({ num: 10 });
 * //    ^? { readonly num: number }
 * ```
 *
 * Properties will be specified as static when they are none of:
 *
 * - {@link MutablePropertySpec}
 * - {@link ComputedPropertySpec}
 * - Any function with a non-zero arity (which are not supported for specifying
 *   a state object's properties at all)
 *
 * Any property so specified will produce a property where:
 *
 * - Reading the property will produce the provided static value.
 *
 * - Mutating the property will throw a {@link TypeError}, just as it would when
 *   attempting to mutate a normal `get` accessor (or a
 *   {@link PropertyDescriptor} with `writable: false`).
 *
 * - The property will reflect the same static value on any derived (client)
 *   state object.
 */
export type StaticPropertySpec<T> = Exclude<T, NonStaticValue>;
/**
 * Every state property may be specified with any of these types:
 *
 * - {@link MutablePropertySpec}
 * - {@link ComputedPropertySpec}
 * - {@link StaticPropertySpec}
 */
export type StatePropertySpec<T = any> = MutablePropertySpec<T> | ComputedPropertySpec<T> | StaticPropertySpec<T>;
export declare const isMutablePropertySpec: <T>(propertySpec: StatePropertySpec<T>) => propertySpec is MutablePropertySpec<T>;
export declare const isComputedPropertySpec: <T>(propertySpec: StatePropertySpec<T>) => propertySpec is ComputedPropertySpec<T>;
export declare const isStaticPropertySpec: <T>(propertySpec: StatePropertySpec<T>) => propertySpec is StaticPropertySpec<T>;
export type StateSpec = Record<string, StatePropertySpec>;
type SpecifiedStatePropertyValue<PropertySpec extends StatePropertySpec> = PropertySpec extends StatePropertySpec<infer T> ? T : never;
type DerivedMutableKeys<Spec extends StateSpec> = {
    [K in keyof Spec]: Spec[K] extends MutablePropertySpec<any> ? K : never;
}[keyof Spec];
type DerivedMutableState<Spec extends StateSpec> = {
    -readonly [K in DerivedMutableKeys<Spec>]: SpecifiedStatePropertyValue<Spec[K]>;
};
type DerivedReadableKeys<Spec extends StateSpec> = Exclude<keyof Spec, DerivedMutableKeys<Spec>>;
type DerivedReadableState<Spec extends StateSpec> = {
    readonly [K in DerivedReadableKeys<Spec>]: SpecifiedStatePropertyValue<Spec[K]>;
};
export type SpecifiedState<Spec extends StateSpec> = (DerivedMutableState<Spec> & DerivedReadableState<Spec>) extends infer DerivedState ? {
    [K in keyof Spec]: K extends keyof DerivedState ? DerivedState[K] : never;
} : never;
/**
 * Produces an (internally) reactive object whose properties may be a mix of:
 *
 * - {@link MutablePropertySpec | mutable} (atomically reactive when mutated by
 *   engine internal logic; reactively propagated as read-only to clients)
 * - {@link ComputedPropertySpec | computed} (read-only, reactive to changes in
 *   derived state; reactively propagated as read-only to clients)
 * - {@link StaticPropertySpec | static} (read-only, immutable after creation;
 *   statically propagated as read-only to clients)
 */
export declare const createSpecifiedState: <Spec extends StateSpec>(spec: Spec) => SpecifiedState<Spec>;
export {};
