import { FormResource } from '../client/form/FormResource.ts';
/**
 * @todo This is a placeholder class, given a name so it can be referenced in
 * client interfaces for form loading. It is pending design of errors (broadly)
 * and modeling of form loading errors (specifically).
 */
export declare class LoadFormFailureError extends AggregateError {
    constructor(resource: FormResource, errors: readonly Error[]);
}
