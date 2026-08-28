import { FormInstanceConfig } from '../client/form/FormInstanceConfig.ts';
import { LoadFormOptions } from '../client/form/LoadForm.ts';
import { RestoredFormInstance, RestoreFormInstanceInput } from '../client/form/RestoreFormInstance.ts';
import { FormResource } from '../instance/resource.ts';
export interface RestoreInstanceOptions {
    readonly form?: LoadFormOptions;
    readonly instance?: FormInstanceConfig;
}
export declare const restoreInstance: (formResource: FormResource, input: RestoreFormInstanceInput, options?: RestoreInstanceOptions) => Promise<RestoredFormInstance>;
