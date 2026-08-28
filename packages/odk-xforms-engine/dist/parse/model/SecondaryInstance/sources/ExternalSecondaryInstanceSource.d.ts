import { JRResourceURL } from '../../../../../../common/src/jr-resources/JRResourceURL.ts';
import { DOMSecondaryInstanceElement } from '../../../XFormDOM.ts';
import { ExternalSecondaryInstanceResource } from './ExternalSecondaryInstanceResource.ts';
import { ExternalSecondaryInstanceSourceFormat, SecondaryInstanceSource } from './SecondaryInstanceSource.ts';
export declare abstract class ExternalSecondaryInstanceSource<Format extends ExternalSecondaryInstanceSourceFormat = ExternalSecondaryInstanceSourceFormat> extends SecondaryInstanceSource<Format> {
    protected readonly resource: ExternalSecondaryInstanceResource<Format>;
    readonly resourceURL: JRResourceURL;
    constructor(domElement: DOMSecondaryInstanceElement, resource: ExternalSecondaryInstanceResource<Format>);
}
