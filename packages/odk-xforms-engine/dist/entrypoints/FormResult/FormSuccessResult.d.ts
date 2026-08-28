import { LoadFormSuccessResult } from '../../client/index.ts';
import { BasePrimaryInstanceOptions } from '../../instance/PrimaryInstance.ts';
import { FormResource } from '../../instance/resource.ts';
import { ReactiveScope } from '../../lib/reactivity/scope.ts';
import { BaseInstantiableFormResult } from './BaseInstantiableFormResult.ts';
export interface FormSuccessResultOptions {
    readonly warnings: null;
    readonly error: null;
    readonly scope: ReactiveScope;
    readonly formResource: FormResource;
    readonly instanceOptions: BasePrimaryInstanceOptions;
}
export declare class FormSuccessResult extends BaseInstantiableFormResult<'success'> implements LoadFormSuccessResult {
    constructor(options: FormSuccessResultOptions);
}
