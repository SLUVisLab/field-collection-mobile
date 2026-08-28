interface BaseOpaqueReactiveObjectFactory<in out Input extends object = object> {
    <T extends Input>(object: T): T;
    <T extends object>(object: T): T;
}
/**
 * A client-provided reactivity factory. We assume little about the mechanism
 * of reactivity a client provides (and a client may opt to provide no reactive
 * mechanism at all, if it will consume state changes by other means). From an
 * API perspective, the expectation is:
 *
 * - The factory accepts a single argument, which **MUST** be an object.
 *   Reactive primitive values are unsupported by this interface.
 * - The factory **MUST** return an object of the same shape (i.e. it must
 *   have the same property key/value pairs).
 * - The factory's return object **MUST** be mutable by the web-forms engine.
 * - The web-forms engine **WILL** propagate changes to state as they occur,
 *   by mutating properties of the object corresponding to those aspects of
 *   state.
 * - The client **MAY** read any property of the factory's returned object.
 * - Because the client's reactivity mechanism (if any) is unknown, it is
 *   **ASSUMED** that the engine's mutations are observable by the client,
 *   and that the client has a defined means to subscribe to those mutations.
 *   It is **IMPLIED** (but **NOT REQUIRED**) that the typical reactive client
 *   will subscribe to mutations by reading the pertinent properties of the
 *   reactive object in a reactive context appropriate for that client.
 * - In common usage, the engine **MAY** convey computed getter property types
 *   back to the client, to indicate that certain aspects the engine mutates
 *   are read-only to the client (even if they are mutable by the engine).
 *
 * Real world examples of reactive implementations include:
 *
 * - {@link https://vuejs.org/api/reactivity-core.html#reactive | `reactive` (Vue)}
 * - {@link https://docs.solidjs.com/reference/store-utilities/create-mutable | `createMutable` (Solid)}
 * - {@link DefineMutableObject | our internal `mutable` test helper}
 *
 * Each of these implementations are targeted as part of our effort to ensure
 * the `xforms-engine` is agnostic to a client's framework and/or implementation
 * of state.
 *
 * @example
 *
 * ```ts
 * declare const clientFactory: OpaqueReactiveObjectFactory;
 *
 * interface ClientFoo {
 *   get bar(): string;
 * }
 *
 * interface MutableFoo {
 *   bar: string;
 * }
 *
 * // State internally updated by engine
 * let mutableFoo = clientFactory<MutableFoo>({ bar: 'bat' });
 *
 * // Same state, consumed by the client as computed but read-only
 * let clientFoo: ClientFoo = engineFoo;
 *
 * // Client: subscribe to mutations by the engine
 * reactiveContext(() => {
 *   // Implied client subscription to `clientFoo.bar` on property access
 *   doSomethingWith(clientFoo.bar);
 * });
 *
 * // Engine: mutate values to convey state changes to subscribed client
 * engineFoo.bar = 'quux';
 * ```
 */
export type OpaqueReactiveObjectFactory<Input extends object = object> = BaseOpaqueReactiveObjectFactory<Input> & ((object: object) => unknown);
export {};
