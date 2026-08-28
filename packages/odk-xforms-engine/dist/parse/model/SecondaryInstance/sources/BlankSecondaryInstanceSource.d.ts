import { JRResourceURL } from '../../../../../../common/src/jr-resources/JRResourceURL.ts';
import { DOMSecondaryInstanceElement } from '../../../XFormDOM.ts';
import { SecondaryInstanceDefinition } from '../SecondaryInstancesDefinition.ts';
import { SecondaryInstanceSource } from './SecondaryInstanceSource.ts';
export declare class BlankSecondaryInstanceSource extends SecondaryInstanceSource<'blank'> {
    constructor(instanceId: string, resourceURL: JRResourceURL, domElement: DOMSecondaryInstanceElement);
    parseDefinition(): SecondaryInstanceDefinition;
}
