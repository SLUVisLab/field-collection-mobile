import { ReactiveScope } from '../scope.ts';
import { SpecifiedState, StateSpec } from './createSpecifiedState.ts';
import { EngineRepresentation } from './representations.ts';
export type EngineState<Spec extends StateSpec> = EngineRepresentation<SpecifiedState<Spec>>;
export declare const createEngineState: <Spec extends StateSpec>(scope: ReactiveScope, spec: Spec) => EngineState<Spec>;
