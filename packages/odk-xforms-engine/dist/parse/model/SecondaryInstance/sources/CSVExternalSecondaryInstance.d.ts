import { SecondaryInstanceDefinition } from '../SecondaryInstancesDefinition.ts';
import { ExternalSecondaryInstanceSource } from './ExternalSecondaryInstanceSource.ts';
export declare class CSVExternalSecondaryInstanceSource extends ExternalSecondaryInstanceSource<'csv'> {
    parseDefinition(): SecondaryInstanceDefinition;
}
