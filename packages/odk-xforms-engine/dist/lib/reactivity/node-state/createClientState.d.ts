import { ShallowMutable } from '../../../../../common/types/helpers.js';
import { OpaqueReactiveObjectFactory } from '../../../index.ts';
import { ReactiveScope } from '../scope.ts';
import { EngineState } from './createEngineState.ts';
import { SpecifiedState, StateSpec } from './createSpecifiedState.ts';
import { InternalClientRepresentation } from './representations.ts';
export type SpecifiedClientStateFactory<Factory extends OpaqueReactiveObjectFactory, Spec extends StateSpec> = ShallowMutable<SpecifiedState<Spec>> extends Parameters<Factory>[0] ? Factory : never;
export type ClientState<Spec extends StateSpec> = InternalClientRepresentation<SpecifiedState<Spec>>;
export declare const createClientState: <Factory extends OpaqueReactiveObjectFactory, Spec extends StateSpec>(scope: ReactiveScope, engineState: EngineState<Spec>, clientStateFactory: SpecifiedClientStateFactory<Factory, Spec>) => ClientState<Spec>;
