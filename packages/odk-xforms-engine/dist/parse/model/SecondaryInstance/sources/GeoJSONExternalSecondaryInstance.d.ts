import { SecondaryInstanceDefinition } from '../SecondaryInstancesDefinition.ts';
import { ExternalSecondaryInstanceSource } from './ExternalSecondaryInstanceSource.ts';
export declare class GeoJSONExternalSecondaryInstanceSource extends ExternalSecondaryInstanceSource<'geojson'> {
    parseDefinition(): SecondaryInstanceDefinition;
}
