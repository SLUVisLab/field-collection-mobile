import { FormResource } from '../client/form/FormResource.ts';
import { FetchResource, FetchResourceResponse } from '../client/resources.ts';
export type { FetchResource, FetchResourceResponse, FormResource };
export interface ResourceOptions {
    readonly fetchResource: FetchResource;
}
declare const resourceXMLPrefix = "<";
type ResourceXMLPrefix = typeof resourceXMLPrefix;
type ResourceXML = `${ResourceXMLPrefix}${string}`;
export declare const retrieveSourceXMLResource: (resource: FormResource, options: ResourceOptions) => Promise<ResourceXML>;
interface RetrieveFormDefinitionOptions {
    readonly fetchFormDefinition: FetchResource;
}
export declare const retrieveFormDefinition: (resource: FormResource, options: RetrieveFormDefinitionOptions) => Promise<ResourceXML>;
