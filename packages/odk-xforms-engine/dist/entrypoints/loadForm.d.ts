import { FormResource } from '../client/form/FormResource.ts';
import { LoadFormOptions } from '../client/form/LoadForm.ts';
import { LoadFormResult } from '../client/form/LoadFormResult.ts';
export declare const loadForm: (formResource: FormResource, options?: LoadFormOptions) => Promise<LoadFormResult>;
