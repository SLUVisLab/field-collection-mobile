import { OpaqueReactiveObjectFactory } from '../../../index.ts';
import { ReactiveScope } from '../scope.ts';
import { ClientState, SpecifiedClientStateFactory } from './createClientState.ts';
import { CurrentState } from './createCurrentState.ts';
import { EngineState } from './createEngineState.ts';
import { MutablePropertySpec, SpecifiedState, StateSpec } from './createSpecifiedState.ts';
type MutableKeyOf<Spec extends StateSpec> = {
    [K in Extract<keyof Spec, string>]: Spec[K] extends MutablePropertySpec<any> ? K : never;
}[Extract<keyof Spec, string>];
type SetEnginePropertyState<Spec extends StateSpec> = <K extends MutableKeyOf<Spec>>(key: K, newValue: SpecifiedState<Spec>[K]) => SpecifiedState<Spec>[K];
export interface SharedNodeState<Spec extends StateSpec> {
    readonly spec: Spec;
    readonly engineState: EngineState<Spec>;
    readonly clientState: ClientState<Spec>;
    readonly currentState: CurrentState<Spec>;
    readonly setProperty: SetEnginePropertyState<Spec>;
}
export interface SharedNodeStateOptions<Factory extends OpaqueReactiveObjectFactory, Spec extends StateSpec> {
    readonly clientStateFactory: SpecifiedClientStateFactory<Factory, Spec>;
}
export declare const createSharedNodeState: <Factory extends OpaqueReactiveObjectFactory, Spec extends StateSpec>(scope: ReactiveScope, spec: Spec, options: SharedNodeStateOptions<Factory, Spec>) => SharedNodeState<Spec>;
export {};
