import { DOMSecondaryInstanceElement } from '../../../XFormDOM.ts';
import { SecondaryInstanceDefinition } from '../SecondaryInstancesDefinition.ts';
import { SecondaryInstanceSource } from './SecondaryInstanceSource.ts';
export declare class InternalSecondaryInstanceSource extends SecondaryInstanceSource<'internal'> {
    constructor(instanceId: string, resourceURL: null, domElement: DOMSecondaryInstanceElement);
    parseDefinition(): SecondaryInstanceDefinition;
}
