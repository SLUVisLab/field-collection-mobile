import { Owner } from 'solid-js';
type ReactiveScopeTask<T> = (scope: ReactiveScope) => T;
type RunReactiveScopeTask = <T>(task: ReactiveScopeTask<T>) => T;
export interface ReactiveScope {
    readonly owner: Owner;
    readonly dispose: VoidFunction;
    readonly runTask: RunReactiveScopeTask;
}
interface CreateReactiveScopeOptions {
    readonly owner?: Owner | null;
}
/**
 * Creates a reactive scope for internal engine use. This currently uses Solid's
 * implementation of reactivity, and makes no attempt to obscure that. As such,
 * all of the terms and types exposed are intentionally direct references to
 * their concepts in Solid.
 *
 * This reactive scope is suitable for isolating reactivity between tests. It is
 * also suitable for scoping reactivity for nodes in engine/client state, as
 * well as creating nested scopes for their descendants.
 */
export declare const createReactiveScope: (options?: CreateReactiveScopeOptions) => ReactiveScope;
export {};
