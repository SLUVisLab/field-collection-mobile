import { ReactiveScope } from '../scope.ts';
import { ClientState } from './createClientState.ts';
import { SpecifiedState, StateSpec } from './createSpecifiedState.ts';
import { ReadonlyClientRepresentation } from './representations.ts';
export type CurrentState<Spec extends StateSpec> = ReadonlyClientRepresentation<SpecifiedState<Spec>>;
export declare const createCurrentState: <Spec extends StateSpec>(scope: ReactiveScope, clientState: ClientState<Spec>) => CurrentState<Spec>;
