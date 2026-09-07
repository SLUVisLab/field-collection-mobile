import { CreateFormInstance } from '../../client/form/CreateFormInstance.ts';
import { EditFormInstance } from '../../client/form/EditFormInstance.ts';
import { ResetFormInstance } from '../../client/form/ResetFormInstance.ts';
import { RestoreFormInstance } from '../../client/form/RestoreFormInstance.ts';
import { BasePrimaryInstanceOptions } from '../../instance/PrimaryInstance.ts';
import { FormResource } from '../../instance/resource.ts';
import { ReactiveScope } from '../../lib/reactivity/scope.ts';
import { InstantiableFormResult } from '../FormInstance.ts';
import { BaseFormResultProperty, BaseFormResult } from './BaseFormResult.ts';
export type InstantiableFormResultStatus = 'success' | 'warning';
export interface BaseInstantiableFormResultOptions<Status extends InstantiableFormResultStatus> {
    readonly status: Status;
    readonly warnings: BaseFormResultProperty<Status, 'warnings'>;
    readonly error: null;
    readonly scope: ReactiveScope;
    readonly formResource: FormResource;
    readonly instanceOptions: BasePrimaryInstanceOptions;
}
export declare abstract class BaseInstantiableFormResult<Status extends InstantiableFormResultStatus> extends BaseFormResult<Status> {
    readonly createInstance: CreateFormInstance;
    readonly resetInstance: ResetFormInstance;
    readonly editInstance: EditFormInstance;
    readonly restoreInstance: RestoreFormInstance;
    constructor(options: BaseInstantiableFormResultOptions<Status>);
    isInstantiable(): this is InstantiableFormResult;
    assertInstantiable(): asserts this is InstantiableFormResult;
}
