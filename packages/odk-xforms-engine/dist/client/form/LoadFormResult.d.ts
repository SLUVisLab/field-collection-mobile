import { UnknownObject } from '../../../../common/src/lib/type-assertions/assertUnknownObject.ts';
import { AnyFunction } from '../../../../common/types/helpers.js';
import { LoadFormFailureError } from '../../error/LoadFormFailureError.ts';
import { CreateFormInstance } from './CreateFormInstance.ts';
import { EditFormInstance } from './EditFormInstance.ts';
import { ResetFormInstance } from './ResetFormInstance.ts';
import { RestoreFormInstance } from './RestoreFormInstance.ts';
export type { LoadFormFailureError };
export type FormResultStatus = 'success' | 'warning' | 'failure';
/**
 * @todo Pending design and modeling of warning cases.
 */
export type LoadFormWarnings = UnknownObject;
type FailedLoadFormResultMethodParameters<T extends AnyFunction> = readonly never[] & (Parameters<T> extends {
    readonly length: infer Length extends number;
} ? {
    readonly length: Length;
} : never);
export type FailedLoadFormResultMethod<T extends AnyFunction> = (...args: FailedLoadFormResultMethodParameters<T>) => never;
export type FallibleLoadFormResultMethod<T extends AnyFunction> = T | FailedLoadFormResultMethod<T>;
interface BaseLoadFormResult {
    readonly status: FormResultStatus;
    readonly warnings: LoadFormWarnings | null;
    readonly error: LoadFormFailureError | null;
    readonly createInstance: FallibleLoadFormResultMethod<CreateFormInstance>;
    readonly resetInstance: FallibleLoadFormResultMethod<ResetFormInstance>;
    readonly editInstance: FallibleLoadFormResultMethod<EditFormInstance>;
    readonly restoreInstance: FallibleLoadFormResultMethod<RestoreFormInstance>;
}
export interface LoadFormSuccessResult extends BaseLoadFormResult {
    readonly status: 'success';
    readonly warnings: null;
    readonly error: null;
    readonly createInstance: CreateFormInstance;
    readonly resetInstance: ResetFormInstance;
    readonly editInstance: EditFormInstance;
    readonly restoreInstance: RestoreFormInstance;
}
export interface LoadFormWarningResult extends BaseLoadFormResult {
    readonly status: 'warning';
    readonly warnings: LoadFormWarnings;
    readonly error: null;
    readonly createInstance: CreateFormInstance;
    readonly resetInstance: ResetFormInstance;
    readonly editInstance: EditFormInstance;
    readonly restoreInstance: RestoreFormInstance;
}
export interface LoadFormFailureResult extends BaseLoadFormResult {
    readonly status: 'failure';
    readonly warnings: LoadFormWarnings | null;
    readonly error: LoadFormFailureError;
    readonly createInstance: FailedLoadFormResultMethod<CreateFormInstance>;
    readonly resetInstance: FailedLoadFormResultMethod<ResetFormInstance>;
    readonly editInstance: FailedLoadFormResultMethod<EditFormInstance>;
    readonly restoreInstance: FailedLoadFormResultMethod<RestoreFormInstance>;
}
export type InstantiableLoadFormResult = LoadFormSuccessResult | LoadFormWarningResult;
export type LoadFormResult = InstantiableLoadFormResult | LoadFormFailureResult;
