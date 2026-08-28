import { CreatedFormInstance } from '../client/form/CreateFormInstance.ts';
import { FormInstanceConfig } from '../client/form/FormInstanceConfig.ts';
import { LoadFormOptions } from '../client/form/LoadForm.ts';
import { FormResource } from '../instance/resource.ts';
export interface CreateInstanceOptions {
    readonly form?: LoadFormOptions;
    readonly instance?: FormInstanceConfig;
}
export declare const createInstance: (formResource: FormResource, options?: CreateInstanceOptions) => Promise<CreatedFormInstance>;
