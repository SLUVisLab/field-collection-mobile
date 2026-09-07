import { JRResourceURL } from '../../../../../../common/src/jr-resources/JRResourceURL.ts';
import { DOMSecondaryInstanceElement } from '../../../XFormDOM.ts';
import { SecondaryInstanceDefinition } from '../SecondaryInstancesDefinition.ts';
export type ExternalSecondaryInstanceSourceFormat = 'csv' | 'geojson' | 'xml';
export type SecondaryInstanceSourceFormat = ExternalSecondaryInstanceSourceFormat | 'internal' | 'blank';
export declare abstract class SecondaryInstanceSource<Format extends SecondaryInstanceSourceFormat = SecondaryInstanceSourceFormat> {
    readonly format: Format;
    readonly instanceId: string;
    readonly resourceURL: JRResourceURL | null;
    readonly domElement: DOMSecondaryInstanceElement;
    constructor(format: Format, instanceId: string, resourceURL: JRResourceURL | null, domElement: DOMSecondaryInstanceElement);
    abstract parseDefinition(): SecondaryInstanceDefinition;
}
