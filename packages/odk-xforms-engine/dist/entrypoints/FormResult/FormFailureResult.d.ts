import { CreateFormInstance } from '../../client/form/CreateFormInstance.ts';
import { EditFormInstance } from '../../client/form/EditFormInstance.ts';
import { FailedLoadFormResultMethod, LoadFormFailureResult, LoadFormWarnings } from '../../client/form/LoadFormResult.ts';
import { ResetFormInstance } from '../../client/form/ResetFormInstance.ts';
import { RestoreFormInstance } from '../../client/form/RestoreFormInstance.ts';
import { LoadFormFailureError } from '../../error/LoadFormFailureError.ts';
import { BaseFormResult } from './BaseFormResult.ts';
interface FormFailureOptions {
    readonly error: LoadFormFailureError;
    readonly warnings: LoadFormWarnings | null;
}
export declare class FormFailureResult extends BaseFormResult<'failure'> implements LoadFormFailureResult {
    readonly createInstance: FailedLoadFormResultMethod<CreateFormInstance>;
    readonly resetInstance: FailedLoadFormResultMethod<ResetFormInstance>;
    readonly editInstance: FailedLoadFormResultMethod<EditFormInstance>;
    readonly restoreInstance: FailedLoadFormResultMethod<RestoreFormInstance>;
    constructor(options: FormFailureOptions);
}
export {};
