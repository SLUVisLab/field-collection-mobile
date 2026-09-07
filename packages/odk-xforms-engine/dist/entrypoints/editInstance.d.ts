import { EditedFormInstance, EditFormInstanceInput } from '../client/form/EditFormInstance.ts';
import { FormInstanceConfig } from '../client/form/FormInstanceConfig.ts';
import { LoadFormOptions } from '../client/form/LoadForm.ts';
import { FormResource } from '../instance/resource.ts';
export interface EditInstanceOptions {
    readonly form?: LoadFormOptions;
    readonly instance?: FormInstanceConfig;
}
export declare const editInstance: (formResource: FormResource, input: EditFormInstanceInput, options?: EditInstanceOptions) => Promise<EditedFormInstance>;
