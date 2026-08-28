import { Accessor } from 'solid-js';
import { FormInstanceInitializationMode } from '../../client/index.ts';
import { StaticLeafElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { ReactiveScope } from '../../lib/reactivity/scope.ts';
import { BindComputationExpression } from '../../parse/expression/BindComputationExpression.ts';
import { AnyBindPreloadDefinition } from '../../parse/model/BindPreloadDefinition.ts';
import { ModelDefinition } from '../../parse/model/ModelDefinition.ts';
import { EvaluationContext } from './EvaluationContext.ts';
import { InstanceConfig } from './InstanceConfig.ts';
import { ActionDefinition } from '../../parse/model/ActionDefinition.ts';
export interface InstanceValueContextDocument {
    readonly initializationMode: FormInstanceInitializationMode;
    readonly isAttached: Accessor<boolean>;
    getBackgroundGeopoint: Accessor<Promise<string>>;
}
export type DecodeInstanceValue = (value: string) => string;
interface InstanceValueContextDefinitionBind {
    readonly preload: AnyBindPreloadDefinition | null;
    readonly calculate: BindComputationExpression<'calculate'> | null;
    readonly readonly: BindComputationExpression<'readonly'>;
}
export interface InstanceValueContextDefinition {
    readonly bind: InstanceValueContextDefinitionBind;
    readonly template: StaticLeafElement;
    readonly model: ModelDefinition;
}
export interface InstanceValueContext extends EvaluationContext {
    readonly scope: ReactiveScope;
    readonly rootDocument: InstanceValueContextDocument;
    readonly definition: InstanceValueContextDefinition;
    readonly instanceNode: StaticLeafElement | null;
    readonly instanceConfig: InstanceConfig;
    readonly decodeInstanceValue: DecodeInstanceValue;
    readonly valueChangedActions: ActionDefinition[];
    isReadonly(): boolean;
    isRelevant(): boolean;
}
export {};
