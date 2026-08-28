import { LoadFormWarningResult, LoadFormWarnings } from '../../client/form/LoadFormResult.ts';
import { BasePrimaryInstanceOptions } from '../../instance/PrimaryInstance.ts';
import { FormResource } from '../../instance/resource.ts';
import { ReactiveScope } from '../../lib/reactivity/scope.ts';
import { BaseInstantiableFormResult } from './BaseInstantiableFormResult.ts';
export interface FormWarningResultOptions {
    readonly warnings: LoadFormWarnings;
    readonly error: null;
    readonly scope: ReactiveScope;
    readonly formResource: FormResource;
    readonly instanceOptions: BasePrimaryInstanceOptions;
}
export declare class FormWarningResult extends BaseInstantiableFormResult<'warning'> implements LoadFormWarningResult {
    constructor(options: FormWarningResultOptions);
}
