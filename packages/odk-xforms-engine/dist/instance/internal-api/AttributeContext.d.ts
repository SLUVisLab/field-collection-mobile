import { Accessor } from 'solid-js';
import { FormInstanceInitializationMode } from '../../client/index.ts';
import { StaticAttribute } from '../../integration/xpath/static-dom/StaticAttribute.ts';
import { ReactiveScope } from '../../lib/reactivity/scope.ts';
import { BindComputationExpression } from '../../parse/expression/BindComputationExpression.ts';
import { AnyBindPreloadDefinition } from '../../parse/model/BindPreloadDefinition.ts';
import { ModelDefinition } from '../../parse/model/ModelDefinition.ts';
import { EvaluationContext } from './EvaluationContext.ts';
import { InstanceConfig } from './InstanceConfig.ts';
import { ActionDefinition } from '../../parse/model/ActionDefinition.ts';
export interface InstanceAttributeContextDocument {
    readonly initializationMode: FormInstanceInitializationMode;
    readonly isAttached: Accessor<boolean>;
    getBackgroundGeopoint: Accessor<Promise<string>>;
}
export type DecodeInstanceValue = (value: string) => string;
interface InstanceAttributeContextDefinitionBind {
    readonly preload: AnyBindPreloadDefinition | null;
    readonly calculate: BindComputationExpression<'calculate'> | null;
    readonly readonly: BindComputationExpression<'readonly'>;
}
export interface InstanceAttributeContextDefinition {
    readonly bind: InstanceAttributeContextDefinitionBind;
    readonly template: StaticAttribute;
    readonly model: ModelDefinition;
}
export interface AttributeContext extends EvaluationContext {
    readonly scope: ReactiveScope;
    readonly rootDocument: InstanceAttributeContextDocument;
    readonly definition: InstanceAttributeContextDefinition;
    readonly instanceNode: StaticAttribute;
    readonly instanceConfig: InstanceConfig;
    readonly decodeInstanceValue: DecodeInstanceValue;
    readonly valueChangedActions: ActionDefinition[];
    isReadonly(): boolean;
    isRelevant(): boolean;
}
export {};
