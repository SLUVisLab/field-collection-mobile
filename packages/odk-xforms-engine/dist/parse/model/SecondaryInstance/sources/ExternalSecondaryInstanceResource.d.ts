import { JRResourceURL } from '../../../../../../common/src/jr-resources/JRResourceURL.ts';
import { MissingResourceBehavior } from '../../../../client/constants.ts';
import { FetchResource } from '../../../../client/resources.ts';
import { FormAttachmentResource } from '../../../attachments/FormAttachmentResource.ts';
import { ExternalSecondaryInstanceSourceFormat } from './SecondaryInstanceSource.ts';
export interface ExternalSecondaryInstanceResourceLoadOptions {
    readonly fetchResource: FetchResource<JRResourceURL>;
    readonly missingResourceBehavior: MissingResourceBehavior;
}
type LoadedExternalSecondaryInstanceResource = {
    [Format in ExternalSecondaryInstanceSourceFormat]: ExternalSecondaryInstanceResource<Format>;
}[ExternalSecondaryInstanceSourceFormat];
export declare class ExternalSecondaryInstanceResource<Format extends ExternalSecondaryInstanceSourceFormat = ExternalSecondaryInstanceSourceFormat> extends FormAttachmentResource<'secondary-instance'> {
    readonly responseStatus: number | null;
    readonly instanceId: string;
    readonly format: Format;
    private static isMissingResource;
    private static createBlankResource;
    static load(instanceId: string, resourceURL: JRResourceURL, options: ExternalSecondaryInstanceResourceLoadOptions): Promise<LoadedExternalSecondaryInstanceResource>;
    readonly isBlank: boolean;
    private constructor();
}
export {};
