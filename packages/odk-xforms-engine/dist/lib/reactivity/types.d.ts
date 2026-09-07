import { Accessor, Setter } from 'solid-js';
/**
 * A write interface to reactive atomic state. This type is intended to be used
 * as a relaxed version of {@link Setter}, where its callback form isn't
 * required for conforming implementations.
 */
export type SimpleAtomicStateSetter<T> = (newValue: T) => T;
/**
 * A read/write interface to reactive atomic state. This type is intended to be
 * used as a relaxed version of {@link Signal}, with a
 * {@link SimpleAtomicStateSetter | simpler setter type}.
 */
export type SimpleAtomicState<T> = readonly [
    get: Accessor<T>,
    set: SimpleAtomicStateSetter<T>
];
export type AtomicStateSetter<T> = Setter<T> | SimpleAtomicStateSetter<T>;
export type AtomicState<T> = readonly [
    get: Accessor<T>,
    set: AtomicStateSetter<T>
];
